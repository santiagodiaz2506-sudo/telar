import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Hand, Lock, MessageSquareDashed, Undo2 } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { AssigneePicker } from '@/components/inbox/AssigneePicker'
import { Composer } from '@/components/inbox/Composer'
import { ContactPanel } from '@/components/inbox/ContactPanel'
import { DaySeparator, MessageBubble } from '@/components/inbox/MessageBubble'
import { StatusBadge } from '@/components/StatusBadge'
import { ContactAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  assignConversation,
  getConversationDetail,
  getMembers,
  releaseConversation,
  resolveConversation,
  sendMessage,
} from '@/lib/endpoints'
import { dayKey, dayLabel, formatPhone } from '@/lib/format'
import { isElevated } from '@/lib/roles'
import { serviceWindow } from '@/lib/serviceWindow'
import { useCachedConversation } from '@/lib/useCachedConversation'
import type { MessageResponse } from '@/types/api'

/** Dos mensajes seguidos del mismo autor dentro de 3 minutos se agrupan. */
const GROUP_WINDOW_MS = 3 * 60 * 1000

export function ThreadPage() {
  const { accountId, conversationId } = useParams<{
    accountId: string
    conversationId: string
  }>()
  const { user, roleForAccount } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = React.useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  const { data: conv, isLoading } = useQuery({
    queryKey: ['conversation', accountId, conversationId],
    queryFn: () => getConversationDetail(accountId!, conversationId!),
    enabled: !!accountId && !!conversationId,
    refetchInterval: 5000,
  })

  const role = accountId ? roleForAccount(accountId) : null
  const canOverride = isElevated(role)

  /* Los nombres del equipo solo hacen falta si podés reasignar o si querés
     saber quién tiene la conversación. */
  const { data: members } = useQuery({
    queryKey: ['members', accountId],
    queryFn: () => getMembers(accountId!),
    enabled: !!accountId,
    staleTime: 60_000,
  })

  const summary = useCachedConversation(accountId, conversationId)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [conv?.messages.length, conversationId])

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversation', accountId, conversationId] })
    queryClient.invalidateQueries({ queryKey: ['conversations', accountId] })
    queryClient.invalidateQueries({ queryKey: ['stats', accountId] })
  }, [queryClient, accountId, conversationId])

  const runAction = React.useCallback(
    async (fallback: string, action: () => Promise<unknown>, success?: string) => {
      setBusy(true)
      try {
        await action()
        invalidate()
        if (success) toast.success(success)
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : fallback)
      } finally {
        setBusy(false)
      }
    },
    [invalidate],
  )

  if (!accountId || !conversationId) return null
  if (isLoading || !conv) return <ThreadSkeleton />

  const contactName = summary?.contact_name ?? formatPhone(summary?.contact_phone) ?? 'Sin nombre'
  const isMine = conv.assignee_id === user?.id
  const canWrite = conv.status === 'open' && (isMine || canOverride)

  const assignee = members?.find((m) => m.user_id === conv.assignee_id)
  const assigneeName = conv.assignee_id
    ? isMine
      ? `${user?.name} (vos)`
      : (assignee?.name ?? 'Otro asesor')
    : null

  /**
   * El backend valida la ventana en el envío; acá la anticipamos con el
   * último mensaje entrante. `last_contact_message_at` de la lista es la
   * fuente buena; el hilo es el respaldo cuando la conversación no está en
   * ninguna página cargada.
   */
  const lastInbound = [...conv.messages].reverse().find((m) => m.sender_type === 'contact')
  const sw = serviceWindow(summary?.last_contact_message_at ?? lastInbound?.created_at ?? null)

  async function handleSend(text: string) {
    try {
      await sendMessage(accountId!, conversationId!, text)
      invalidate()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo enviar el mensaje')
      throw e
    }
  }

  function assign(assigneeId?: string) {
    const target = assigneeId ? members?.find((m) => m.user_id === assigneeId)?.name : null
    runAction(
      'No se pudo asignar la conversación',
      () => assignConversation(accountId!, conversationId!, assigneeId),
      target ? `Asignada a ${target}` : 'Tomaste la conversación',
    )
  }

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <ContactAvatar seed={conv.contact_id} name={summary?.contact_name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-semibold">{contactName}</p>
            <p className="tabular truncate font-mono text-[11px] text-muted-foreground">
              {formatPhone(summary?.contact_phone)}
            </p>
          </div>

          {/* En xl el panel derecho ya muestra el estado; acá solo estorba y
              le come el ancho al nombre del contacto. */}
          <StatusBadge
            status={conv.status}
            size="sm"
            className="hidden shrink-0 sm:inline-flex xl:hidden"
          />

          <div className="flex shrink-0 items-center gap-2">
            {conv.status !== 'open' && (
              <Button size="sm" disabled={busy} onClick={() => assign()}>
                <Hand />
                Tomar
              </Button>
            )}

            {canOverride && (
              <AssigneePicker
                accountId={accountId}
                assigneeId={conv.assignee_id}
                disabled={busy}
                onAssign={assign}
              />
            )}

            {conv.status === 'open' && isMine && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      'No se pudo devolver a la cola',
                      () => releaseConversation(accountId, conversationId),
                      'Volvió a la cola',
                    )
                  }
                >
                  <Undo2 />
                  Devolver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      'No se pudo resolver',
                      () => resolveConversation(accountId, conversationId),
                      'Conversación resuelta',
                    )
                  }
                >
                  <CheckCheck />
                  Resolver
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {conv.messages.length === 0 ? (
            <EmptyState
              icon={MessageSquareDashed}
              title="Todavía no hay mensajes"
              description="Cuando el contacto escriba, o cuando el agente responda, los mensajes aparecen acá."
            />
          ) : (
            <div className="mx-auto max-w-3xl">
              {/* La API devuelve como máximo los últimos 50 mensajes y no
                  expone un parámetro para pedir más atrás. */}
              {conv.messages.length >= 50 && (
                <p className="mb-4 rounded-lg border border-dashed border-border px-3 py-2 text-center text-[11.5px] text-muted-foreground">
                  Se muestran los últimos 50 mensajes. La API todavía no permite traer los
                  anteriores.
                </p>
              )}
              {groupMessages(conv.messages).map((entry) =>
                entry.kind === 'day' ? (
                  <DaySeparator key={`day-${entry.key}`} label={entry.label} />
                ) : (
                  <MessageBubble
                    key={entry.message.id}
                    message={entry.message}
                    grouped={entry.grouped}
                  />
                ),
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {canWrite ? (
          <Composer onSend={handleSend} contactName={contactName} window={sw} />
        ) : (
          <LockedComposer
            status={conv.status}
            busy={busy}
            canTake={conv.status !== 'open'}
            takenByOther={conv.status === 'open' && !isMine}
            assigneeName={assignee?.name}
            onTake={() => assign()}
          />
        )}
      </div>

      <ContactPanel
        conversation={conv}
        contactName={contactName}
        contactPhone={summary?.contact_phone ?? null}
        assigneeName={assigneeName}
        serviceWindow={sw}
      />
    </div>
  )
}

function LockedComposer({
  status,
  busy,
  canTake,
  takenByOther,
  assigneeName,
  onTake,
}: {
  status: string
  busy: boolean
  canTake: boolean
  takenByOther: boolean
  assigneeName?: string
  onTake: () => void
}) {
  const message = takenByOther
    ? `Esta conversación la tiene ${assigneeName ?? 'otro asesor'}.`
    : status === 'bot'
      ? 'El agente de IA está atendiendo. Si la tomás, la IA deja de responder.'
      : status === 'pending'
        ? 'El cliente pidió hablar con una persona y nadie la tomó todavía.'
        : 'La conversación está cerrada. Tomala si necesitás retomar el contacto.'

  return (
    <div className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3.5">
      <Lock className="size-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-[13px] text-muted-foreground">{message}</p>
      {canTake && (
        <Button size="sm" disabled={busy} onClick={onTake}>
          <Hand />
          Tomar y responder
        </Button>
      )}
    </div>
  )
}

type Entry =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; message: MessageResponse; grouped: boolean }

function groupMessages(messages: MessageResponse[]): Entry[] {
  const entries: Entry[] = []
  let lastDay: string | null = null
  let previous: MessageResponse | null = null

  for (const message of messages) {
    const key = dayKey(message.created_at)
    if (key !== lastDay) {
      entries.push({ kind: 'day', key, label: dayLabel(message.created_at) })
      lastDay = key
      previous = null
    }

    const grouped =
      !!previous &&
      previous.sender_type === message.sender_type &&
      message.sender_type !== 'system' &&
      new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() <
        GROUP_WINDOW_MS

    entries.push({ kind: 'message', message, grouped })
    previous = message
  }

  return entries
}

function ThreadSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-12 w-64 rounded-2xl" />
        <Skeleton className="h-16 w-80 self-end rounded-2xl" />
        <Skeleton className="h-10 w-52 rounded-2xl" />
        <Skeleton className="h-12 w-72 self-end rounded-2xl" />
      </div>
    </div>
  )
}

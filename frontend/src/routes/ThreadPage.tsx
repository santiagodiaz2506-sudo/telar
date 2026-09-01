import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Hand, Lock, MessageSquareDashed, Undo2, UserPlus } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
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
  getContacts,
  getConversationDetail,
  releaseConversation,
  resolveConversation,
  sendMessage,
} from '@/lib/endpoints'
import { dayKey, dayLabel, formatPhone } from '@/lib/format'
import type { MessageResponse } from '@/types/api'

const ELEVATED_ROLES = ['administrator', 'supervisor', 'superadmin']

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

  const { data: contacts } = useQuery({
    queryKey: ['contacts', accountId],
    queryFn: () => getContacts(accountId!),
    enabled: !!accountId,
    staleTime: 60_000,
  })

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

  const contact = contacts?.find((c) => c.id === conv.contact_id)
  const contactName = contact?.name ?? formatPhone(contact?.phone) ?? 'Sin nombre'
  const role = roleForAccount(accountId)
  const isMine = conv.assignee_id === user?.id
  const canOverride = role ? ELEVATED_ROLES.includes(role) : false
  const canWrite = conv.status === 'open' && isMine

  async function handleSend(text: string) {
    try {
      await sendMessage(accountId!, conversationId!, text)
      invalidate()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo enviar el mensaje')
      throw e
    }
  }

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {/* Encabezado del hilo */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <ContactAvatar seed={conv.contact_id} name={contact?.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold">{contactName}</p>
            <p className="tabular truncate font-mono text-[11px] text-muted-foreground">
              {formatPhone(contact?.phone)}
            </p>
          </div>

          <StatusBadge status={conv.status} size="sm" className="ml-2 hidden sm:inline-flex" />

          <div className="ml-auto flex items-center gap-2">
            {conv.status !== 'open' && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  runAction(
                    'No se pudo tomar la conversación',
                    () => assignConversation(accountId, conversationId),
                    'Tomaste la conversación',
                  )
                }
              >
                <Hand />
                Tomar
              </Button>
            )}
            {conv.status === 'open' && !isMine && canOverride && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  runAction(
                    'No se pudo reasignar',
                    () => assignConversation(accountId, conversationId),
                    'Te la reasignaste',
                  )
                }
              >
                <UserPlus />
                Reasignarme
              </Button>
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

        {/* Hilo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {conv.messages.length === 0 ? (
            <EmptyState
              icon={MessageSquareDashed}
              title="Todavía no hay mensajes"
              description="Cuando el contacto escriba, o cuando el agente responda, los mensajes aparecen acá."
            />
          ) : (
            <div className="mx-auto max-w-3xl">
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

        {/* Redacción o el motivo por el que no se puede escribir */}
        {canWrite ? (
          <Composer onSend={handleSend} contactName={contactName} />
        ) : (
          <LockedComposer
            status={conv.status}
            busy={busy}
            canTake={conv.status !== 'open'}
            takenByOther={conv.status === 'open' && !isMine}
            onTake={() =>
              runAction(
                'No se pudo tomar la conversación',
                () => assignConversation(accountId, conversationId),
                'Tomaste la conversación',
              )
            }
          />
        )}
      </div>

      <ContactPanel
        conversation={conv}
        contact={contact}
        assigneeName={conv.assignee_id ? (isMine ? `${user?.name} (vos)` : 'Otro asesor') : null}
      />
    </div>
  )
}

function LockedComposer({
  status,
  busy,
  canTake,
  takenByOther,
  onTake,
}: {
  status: string
  busy: boolean
  canTake: boolean
  takenByOther: boolean
  onTake: () => void
}) {
  const message = takenByOther
    ? 'Esta conversación la tiene otro asesor.'
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

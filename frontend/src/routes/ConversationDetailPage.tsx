import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { MessageBubble } from '@/components/MessageBubble'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  assignConversation,
  getConversationDetail,
  releaseConversation,
  resolveConversation,
  sendMessage,
} from '@/lib/endpoints'

const ELEVATED_ROLES = ['administrator', 'supervisor', 'superadmin']

export function ConversationDetailPage() {
  const { accountId, conversationId } = useParams<{
    accountId: string
    conversationId: string
  }>()
  const { user, roleForAccount } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  const { data: conv, isLoading } = useQuery({
    queryKey: ['conversation', accountId, conversationId],
    queryFn: () => getConversationDetail(accountId!, conversationId!),
    enabled: !!accountId && !!conversationId,
    refetchInterval: 5000,
  })

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [conv?.messages.length])

  if (!accountId || !conversationId) return null
  if (isLoading || !conv) return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>

  const role = roleForAccount(accountId)
  const isMine = conv.assignee_id === user?.id
  const canOverride = role ? ELEVATED_ROLES.includes(role) : false

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['conversation', accountId, conversationId] })
    queryClient.invalidateQueries({ queryKey: ['conversations', accountId] })
    queryClient.invalidateQueries({ queryKey: ['stats', accountId] })
  }

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      invalidate()
    } catch (e) {
      const message = e instanceof ApiError ? e.message : `No se pudo ${label}`
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSend() {
    if (!text.trim()) return
    setBusy(true)
    try {
      await sendMessage(accountId!, conversationId!, text)
      setText('')
      invalidate()
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'No se pudo enviar'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <StatusBadge status={conv.status} />
        <div className="flex gap-2">
          {conv.status !== 'open' && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => runAction('tomarla', () => assignConversation(accountId!, conversationId!))}
            >
              Tomar
            </Button>
          )}
          {conv.status === 'open' && !isMine && canOverride && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => runAction('reasignarla', () => assignConversation(accountId!, conversationId!))}
            >
              Reasignarme
            </Button>
          )}
          {conv.status === 'open' && isMine && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => runAction('devolverla a la cola', () => releaseConversation(accountId!, conversationId!))}
              >
                Devolver a la cola
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => runAction('resolverla', () => resolveConversation(accountId!, conversationId!))}
              >
                Resolver
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {conv.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {conv.messages.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay mensajes.</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t p-4">
        {conv.status === 'open' && isMine ? (
          <div className="flex gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribí una respuesta..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <Button onClick={handleSend} disabled={busy || !text.trim()}>
              Enviar
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {conv.status === 'open'
              ? 'Esta conversación la tiene otra persona.'
              : 'Tomá la conversación para poder responder.'}
          </p>
        )}
      </div>
    </div>
  )
}

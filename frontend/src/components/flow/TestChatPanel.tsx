import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2, RotateCcw, Send, TestTube2, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { testChat } from '@/lib/endpoints'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'bot' | 'system'
  text: string
  wouldEscalate?: boolean
}

/**
 * Habla con el bot tal cual está configurado -- mismo grafo, tools y
 * modelo que en producción -- sin tocar contactos ni conversaciones
 * reales (ver POST /bot/test-chat). session_id se genera acá y se
 * mantiene mientras el panel esté abierto; "Reiniciar" lo tira y arranca
 * una sesión de prueba nueva, sin memoria del intercambio anterior.
 */
export function TestChatPanel({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const listRef = React.useRef<HTMLDivElement>(null)

  const send = useMutation({
    mutationFn: (text: string) => testChat(accountId, { message: text, session_id: sessionId ?? undefined }),
    onSuccess: (result) => {
      setSessionId(result.session_id)
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'bot', text: result.reply, wouldEscalate: result.would_escalate },
      ])
    },
    onError: (e) => {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'system',
          text: e instanceof ApiError ? e.message : 'No se pudo hablar con el bot.',
        },
      ])
    },
  })

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, send.isPending])

  function handleSend() {
    const text = input.trim()
    if (!text || send.isPending) return
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }])
    setInput('')
    send.mutate(text)
  }

  function handleReset() {
    setSessionId(null)
    setMessages([])
    setInput('')
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-border bg-surface">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <TestTube2 className="size-4 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">Probar el bot</h2>
        <Button variant="ghost" size="icon-sm" onClick={handleReset} aria-label="Reiniciar sesión de prueba" title="Reiniciar">
          <RotateCcw />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar panel">
          <X />
        </Button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[12px] leading-relaxed text-muted-foreground">
            Escribile como si fueras el cliente. Usa el mismo prompt, tools y modelo configurados
            -- sin crear ninguna conversación real en la bandeja.
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col gap-1', m.role === 'user' && 'items-end')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
                  m.role === 'user' && 'bg-primary text-primary-foreground',
                  m.role === 'bot' && 'bg-surface-2 text-foreground',
                  m.role === 'system' && 'bg-destructive-soft text-destructive text-[12px]',
                )}
              >
                {m.text}
              </div>
              {m.wouldEscalate && (
                <span className="flex items-center gap-1 text-[11px] text-status-pending">
                  <AlertTriangle className="size-3" />
                  En producción, esto transfiere a un asesor
                </span>
              )}
            </div>
          ))}
          {send.isPending && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Pensando…
            </div>
          )}
        </div>
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
      >
        <Input
          autoFocus
          placeholder="Escribí un mensaje de prueba…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={send.isPending}
        />
        <Button type="submit" size="icon-sm" disabled={send.isPending || !input.trim()} aria-label="Enviar">
          <Send />
        </Button>
      </form>
    </aside>
  )
}

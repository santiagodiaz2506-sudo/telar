import { CornerDownLeft, SendHorizonal } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_LENGTH = 4096

export function Composer({
  onSend,
  disabled,
  contactName,
}: {
  onSend: (text: string) => Promise<void>
  disabled?: boolean
  contactName: string
}) {
  const [text, setText] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const ref = React.useRef<HTMLTextAreaElement>(null)

  /* Autoajuste de alto, con techo: el hilo no se puede quedar sin espacio. */
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  const tooLong = text.length > MAX_LENGTH
  const canSend = !!text.trim() && !sending && !disabled && !tooLong

  async function submit() {
    if (!canSend) return
    setSending(true)
    try {
      await onSend(text.trim())
      setText('')
      ref.current?.focus()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div
        className={cn(
          'flex items-end gap-2 rounded-xl border bg-input p-2 transition-[border-color,box-shadow]',
          tooLong
            ? 'border-destructive ring-[3px] ring-destructive/20'
            : 'border-border-strong focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/20',
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled || sending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={`Responderle a ${contactName}…`}
          aria-label="Escribir respuesta"
          className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
        />
        <Button size="icon" onClick={submit} disabled={!canSend} aria-label="Enviar mensaje">
          <SendHorizonal />
        </Button>
      </div>

      <div className="mt-1.5 flex items-center gap-3 px-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CornerDownLeft className="size-3" />
          Enter envía · Shift + Enter salta de línea
        </span>
        {(tooLong || text.length > MAX_LENGTH - 500) && (
          <span className={cn('tabular ml-auto', tooLong && 'font-medium text-destructive')}>
            {text.length} / {MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  )
}

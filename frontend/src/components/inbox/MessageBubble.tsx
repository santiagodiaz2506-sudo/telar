import { Bot, Info } from 'lucide-react'

import { clockTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MessageResponse } from '@/types/api'

export interface BubbleProps {
  message: MessageResponse
  /** El anterior es del mismo autor y cercano en el tiempo: agrupamos. */
  grouped?: boolean
}

/**
 * Tres orígenes, tres tratamientos visuales. Distinguir bot de asesor es lo
 * más importante de esta pantalla: quien audita una conversación necesita ver
 * de un vistazo qué dijo la IA y qué dijo una persona.
 */
export function MessageBubble({ message, grouped = false }: BubbleProps) {
  const { sender_type: sender } = message

  if (sender === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[11px] text-muted-foreground">
          <Info className="size-3" />
          {message.content ?? message.type}
        </span>
      </div>
    )
  }

  const fromContact = sender === 'contact'
  const isBot = sender === 'bot'

  return (
    <div
      className={cn(
        'flex flex-col',
        grouped ? 'mt-0.5' : 'mt-3',
        fromContact ? 'items-start' : 'items-end',
      )}
    >
      {!grouped && !fromContact && (
        <span className="mb-1 flex items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground">
          {isBot ? (
            <>
              <Bot className="size-3" />
              Agente IA
            </>
          ) : (
            'Asesor'
          )}
        </span>
      )}

      <div
        className={cn(
          'group flex max-w-[min(560px,80%)] items-end gap-2',
          fromContact ? 'flex-row' : 'flex-row-reverse',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
            fromContact && 'rounded-bl-md bg-bubble-in text-bubble-in-foreground',
            !fromContact && 'rounded-br-md',
            isBot && 'border border-border-strong bg-bubble-bot text-foreground',
            sender === 'agent' && 'bg-bubble-out text-bubble-out-foreground',
            grouped && (fromContact ? 'rounded-bl-2xl' : 'rounded-br-2xl'),
          )}
        >
          {message.content ?? (
            <span className="text-muted-foreground italic">[{message.type}]</span>
          )}
        </div>
        <time
          dateTime={message.created_at}
          className="tabular shrink-0 pb-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          {clockTime(message.created_at)}
        </time>
      </div>
    </div>
  )
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground capitalize">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

import { cn } from '@/lib/utils'
import type { MessageResponse } from '@/types/api'

const SENDER_LABEL: Record<MessageResponse['sender_type'], string> = {
  contact: 'Cliente',
  bot: 'Bot',
  agent: 'Agente',
  system: 'Sistema',
}

export function MessageBubble({ message }: { message: MessageResponse }) {
  const fromContact = message.sender_type === 'contact'

  return (
    <div className={cn('flex flex-col gap-1', fromContact ? 'items-start' : 'items-end')}>
      <span className="text-xs text-muted-foreground">
        {SENDER_LABEL[message.sender_type]} · {new Date(message.created_at).toLocaleTimeString()}
      </span>
      <div
        className={cn(
          'max-w-md rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
          fromContact ? 'bg-muted' : 'bg-primary text-primary-foreground',
        )}
      >
        {message.content ?? `[${message.type}]`}
      </div>
    </div>
  )
}

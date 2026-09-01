import { Badge } from '@/components/ui/badge'
import type { ConversationStatusValue } from '@/types/api'

const LABELS: Record<ConversationStatusValue, string> = {
  bot: 'Bot',
  pending: 'Pendiente',
  open: 'Abierta',
  resolved: 'Resuelta',
}

const VARIANTS: Record<ConversationStatusValue, 'default' | 'secondary' | 'outline'> = {
  bot: 'secondary',
  pending: 'default',
  open: 'default',
  resolved: 'outline',
}

export function StatusBadge({ status }: { status: ConversationStatusValue }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
}

import { NavLink } from 'react-router-dom'

import { StatusDot, statusLabel } from '@/components/StatusBadge'
import { ContactAvatar } from '@/components/ui/avatar'
import { formatPhone, shortTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ConversationResponse } from '@/types/api'

export function ConversationListItem({
  conversation: c,
  accountId,
  assignedToMe,
}: {
  conversation: ConversationResponse
  accountId: string
  assignedToMe: boolean
}) {
  const name = c.contact_name ?? formatPhone(c.contact_phone) ?? 'Sin nombre'

  return (
    <NavLink
      to={`/accounts/${accountId}/conversations/${c.id}`}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 border-b border-border px-3 py-3 transition-colors duration-150',
          isActive ? 'bg-primary-soft/60' : 'hover:bg-surface-2',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
          )}
          <ContactAvatar seed={c.contact_id} name={c.contact_name} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[13.5px] font-semibold text-foreground">{name}</span>
              <time
                dateTime={c.last_contact_message_at ?? undefined}
                className="tabular ml-auto shrink-0 text-[11px] text-muted-foreground"
              >
                {shortTimestamp(c.last_contact_message_at)}
              </time>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <StatusDot status={c.status} />
              <span className="truncate text-xs text-muted-foreground">
                {statusLabel(c.status)}
              </span>
              {assignedToMe && (
                <span className="ml-auto shrink-0 rounded bg-primary-soft px-1.5 py-px text-[10px] font-semibold text-primary-soft-foreground">
                  Vos
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </NavLink>
  )
}

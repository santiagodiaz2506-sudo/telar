import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Trash2, UserPlus, UsersRound } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { getTeamMembers } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { TeamMemberResponse } from '@/types/api'

import { RemoveTeamMemberDialog } from './RemoveTeamMemberDialog'

export function TeamRow({
  accountId,
  team,
  canAssign,
  onAddClick,
}: {
  accountId: string
  team: { id: string; name: string }
  canAssign: boolean
  onAddClick: () => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [removing, setRemoving] = React.useState<TeamMemberResponse | null>(null)

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: queryKeys.teamMembers(accountId, team.id),
    queryFn: () => getTeamMembers(accountId, team.id),
    enabled: expanded,
  })

  return (
    <li className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
          <UsersRound className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
        <Button variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
          Miembros
        </Button>
        {canAssign && (
          <Button variant="outline" size="xs" onClick={onAddClick}>
            <UserPlus />
            Sumar gente
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3.5">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-lg" />
              ))}
            </div>
          )}

          {teamMembers?.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Todavía nadie en este equipo.</p>
          )}

          {teamMembers && teamMembers.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {teamMembers.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2.5">
                  <ContactAvatar seed={m.user_id} name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {canAssign && (
                    <Button
                      variant="destructive-ghost"
                      size="xs"
                      title="Sacar del equipo"
                      onClick={() => setRemoving(m)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <RemoveTeamMemberDialog
        accountId={accountId}
        teamId={team.id}
        member={removing}
        onOpenChange={(open) => !open && setRemoving(null)}
      />
    </li>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Plus, UsersRound } from 'lucide-react'
import * as React from 'react'

import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getTeams } from '@/lib/endpoints'
import { isAdmin, isElevated } from '@/lib/roles'
import { queryKeys } from '@/lib/queryKeys'

import { AddToTeamDialog } from './AddToTeamDialog'
import { CreateTeamDialog } from './CreateTeamDialog'
import { TeamRow } from './TeamRow'

export function TeamsTab({ accountId, role }: { accountId: string; role: string | null }) {
  const canCreate = isAdmin(role)
  const canAssign = isElevated(role)
  const [creating, setCreating] = React.useState(false)
  const [addingTo, setAddingTo] = React.useState<{ id: string; name: string } | null>(null)

  const { data: teams, isLoading } = useQuery({
    queryKey: queryKeys.teams(accountId),
    queryFn: () => getTeams(accountId),
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Equipos</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Agrupaciones dentro de la cuenta, para encolar los traspasos por área.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus />
            Crear equipo
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {teams?.length === 0 && (
        <EmptyState
          icon={UsersRound}
          title="No hay equipos todavía"
          description="Un equipo agrupa asesores para que las conversaciones escaladas caigan en su cola."
          action={
            canCreate ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus />
                Crear el primero
              </Button>
            ) : undefined
          }
        />
      )}

      {teams && teams.length > 0 && (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => (
            <TeamRow
              key={team.id}
              accountId={accountId}
              team={team}
              canAssign={canAssign}
              onAddClick={() => setAddingTo({ id: team.id, name: team.name })}
            />
          ))}
        </ul>
      )}

      <CreateTeamDialog accountId={accountId} open={creating} onOpenChange={setCreating} />

      <AddToTeamDialog
        accountId={accountId}
        team={addingTo}
        onOpenChange={(open) => !open && setAddingTo(null)}
      />
    </section>
  )
}

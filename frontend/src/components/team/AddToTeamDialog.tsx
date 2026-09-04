import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { addTeamMember, getMembers, getTeamMembers } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'

export function AddToTeamDialog({
  accountId,
  team,
  onOpenChange,
}: {
  accountId: string
  team: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [userId, setUserId] = React.useState('')

  const { data: members } = useQuery({
    queryKey: queryKeys.members(accountId),
    queryFn: () => getMembers(accountId),
    enabled: !!team,
  })

  /* Para no ofrecer sumar a quien ya está en el equipo. */
  const { data: teamMembers } = useQuery({
    queryKey: queryKeys.teamMembers(accountId, team?.id),
    queryFn: () => getTeamMembers(accountId, team!.id),
    enabled: !!team,
  })

  const availableMembers = members?.filter(
    (m) => !teamMembers?.some((tm) => tm.user_id === m.user_id),
  )

  const add = useMutation({
    mutationFn: () => addTeamMember(accountId, team!.id, userId),
    onSuccess: () => {
      toast.success(`Sumado a ${team?.name}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers(accountId, team?.id) })
      setUserId('')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo sumar al equipo'),
  })

  return (
    <Dialog open={!!team} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sumar gente a {team?.name}</DialogTitle>
          <DialogDescription>Elegí de entre los miembros de la cuenta.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-member">Persona</Label>
            <Select
              id="team-member"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Elegí a alguien…</option>
              {availableMembers?.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} · {m.email}
                </option>
              ))}
            </Select>
            {members && members.length > 0 && availableMembers?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Todos los miembros de la cuenta ya están en este equipo.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={add.isPending || !userId}>
              {add.isPending && <Loader2 className="animate-spin" />}
              Sumar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

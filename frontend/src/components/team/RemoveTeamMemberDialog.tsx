import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { ApiError } from '@/lib/api'
import { removeTeamMember } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { TeamMemberResponse } from '@/types/api'

export function RemoveTeamMemberDialog({
  accountId,
  teamId,
  member,
  onOpenChange,
}: {
  accountId: string
  teamId: string
  member: TeamMemberResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: () => removeTeamMember(accountId, teamId, member!.user_id),
    onSuccess: () => {
      toast.success('Sacado del equipo')
      queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers(accountId, teamId) })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo sacar del equipo'),
  })

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sacar a {member?.name} del equipo</DialogTitle>
          <DialogDescription>
            Deja de ver las conversaciones de este equipo. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Sacar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

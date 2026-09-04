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
import { removeMember } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { MemberResponse } from '@/types/api'

export function RemoveMemberDialog({
  accountId,
  member,
  onOpenChange,
}: {
  accountId: string
  member: MemberResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: () => removeMember(accountId, member!.user_id),
    onSuccess: () => {
      toast.success('Miembro dado de baja')
      queryClient.invalidateQueries({ queryKey: queryKeys.members(accountId) })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo dar de baja'),
  })

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sacar a {member?.name}</DialogTitle>
          <DialogDescription>
            Pierde acceso a esta cuenta de inmediato. Esta acción no se puede deshacer.
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

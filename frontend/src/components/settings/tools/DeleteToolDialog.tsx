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
import { deleteTool } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { ToolAdminResponse } from '@/types/api'

export function DeleteToolDialog({
  accountId,
  tool,
  onOpenChange,
}: {
  accountId: string
  tool: ToolAdminResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: () => deleteTool(accountId, tool!.id),
    onSuccess: () => {
      toast.success('Herramienta eliminada')
      queryClient.invalidateQueries({ queryKey: queryKeys.tools(accountId) })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar'),
  })

  return (
    <Dialog open={!!tool} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {tool?.name}</DialogTitle>
          <DialogDescription>
            El agente deja de poder llamarla de inmediato. Esta acción no se puede deshacer.
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
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
import { deleteLlmProvider } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { LlmProviderResponse } from '@/types/api'

export function DeleteProviderDialog({
  accountId,
  provider,
  onOpenChange,
}: {
  accountId: string
  provider: LlmProviderResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: () => deleteLlmProvider(accountId, provider!.id),
    onSuccess: () => {
      toast.success('Proveedor eliminado')
      queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders(accountId) })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar'),
  })

  return (
    <Dialog open={!!provider} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {provider?.name}</DialogTitle>
          <DialogDescription>
            {provider?.is_active
              ? 'Este proveedor está activo: al eliminarlo, el bot vuelve al modelo por defecto de la plataforma.'
              : 'Esta acción no se puede deshacer.'}
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

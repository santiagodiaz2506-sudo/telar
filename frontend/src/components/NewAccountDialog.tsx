import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { createAccount } from '@/lib/endpoints'

/** Crear cuenta es exclusivo de superadmin: es el alta de un cliente nuevo. */
export function NewAccountDialog({
  open,
  onOpenChange,
  goToAccount = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goToAccount?: boolean
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = React.useState('')

  const create = useMutation({
    mutationFn: () => createAccount(name.trim()),
    onSuccess: (account) => {
      toast.success(`Cuenta "${account.name}" creada`)
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setName('')
      onOpenChange(false)
      if (goToAccount) navigate(`/accounts/${account.id}/conversations`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo crear la cuenta'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear cuenta</DialogTitle>
          <DialogDescription>
            Una cuenta es un cliente: tiene sus propias conversaciones, su bot, sus tools y su base
            de conocimiento. Después hay que registrarle un número en la tabla{' '}
            <code className="font-mono text-[12px]">inboxes</code>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-name">Nombre</Label>
            <Input
              id="account-name"
              required
              autoFocus
              placeholder="Mi empresa"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Crear cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

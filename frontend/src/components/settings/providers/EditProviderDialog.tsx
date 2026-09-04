import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { updateLlmProvider } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { LlmProviderResponse } from '@/types/api'

import { ModelDiscoveryField } from './ModelDiscoveryField'
import { PROVIDER_LABEL } from './providerFormConstants'

export function EditProviderDialog({
  accountId,
  provider,
  onOpenChange,
}: {
  accountId: string
  provider: LlmProviderResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [model, setModel] = React.useState('')
  const [baseUrl, setBaseUrl] = React.useState('')
  const [apiKey, setApiKey] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (provider) {
      setName(provider.name)
      setModel(provider.model)
      setBaseUrl(provider.base_url ?? '')
      setApiKey('')
      setError(null)
    }
  }, [provider])

  const update = useMutation({
    mutationFn: () =>
      updateLlmProvider(accountId, provider!.id, {
        name: name.trim(),
        model: model.trim(),
        base_url: baseUrl.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Proveedor actualizado')
      queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders(accountId) })
      onOpenChange(false)
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'No se pudo actualizar el proveedor'),
  })

  return (
    <Dialog open={!!provider} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {provider?.name}</DialogTitle>
          <DialogDescription>
            Proveedor: <span className="font-mono">{provider ? PROVIDER_LABEL[provider.provider] : ''}</span> -- no se
            puede cambiar acá.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            update.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-provider-name">Nombre</Label>
            <Input
              id="edit-provider-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-provider-base-url">URL base (opcional)</Label>
            <Input
              id="edit-provider-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-provider-api-key">Clave API nueva (opcional)</Label>
            <Input
              id="edit-provider-api-key"
              type="password"
              placeholder="Dejar vacío para no cambiar la clave guardada"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {provider && (
            <ModelDiscoveryField
              accountId={accountId}
              provider={provider.provider}
              baseUrl={baseUrl}
              apiKey={apiKey}
              model={model}
              onModelChange={setModel}
            />
          )}

          {error && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending || !name.trim() || !model.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { createLlmProvider } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { LlmProviderKind } from '@/types/api'

import { ModelDiscoveryField } from './ModelDiscoveryField'
import { PROVIDER_LABEL } from './providerFormConstants'

export function CreateProviderDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [provider, setProvider] = React.useState<LlmProviderKind>('openai')
  const [model, setModel] = React.useState('')
  const [baseUrl, setBaseUrl] = React.useState('')
  const [apiKey, setApiKey] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  function reset() {
    setName('')
    setProvider('openai')
    setModel('')
    setBaseUrl('')
    setApiKey('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const create = useMutation({
    mutationFn: () =>
      createLlmProvider(accountId, {
        name: name.trim(),
        provider,
        model: model.trim(),
        base_url: baseUrl.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Proveedor creado')
      queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders(accountId) })
      reset()
      onOpenChange(false)
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'No se pudo crear el proveedor'),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo proveedor LLM</DialogTitle>
          <DialogDescription>
            La clave se cifra antes de guardarse. Crear un proveedor no lo activa -- eso se hace
            aparte, desde la lista.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            create.mutate()
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider-name">Nombre</Label>
              <Input
                id="provider-name"
                required
                autoFocus
                placeholder="OpenRouter prod"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider-kind">Proveedor</Label>
              <Select
                id="provider-kind"
                value={provider}
                onChange={(e) => setProvider(e.target.value as LlmProviderKind)}
              >
                {Object.entries(PROVIDER_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="provider-base-url">URL base (opcional)</Label>
            <Input
              id="provider-base-url"
              placeholder="https://openrouter.ai/api/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="provider-api-key">Clave API</Label>
            <Input
              id="provider-api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <ModelDiscoveryField
            accountId={accountId}
            provider={provider}
            baseUrl={baseUrl}
            apiKey={apiKey}
            model={model}
            onModelChange={setModel}
          />

          {error && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending || !name.trim() || !model.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cpu, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '@/lib/api'
import {
  activateLlmProvider,
  createLlmProvider,
  deleteLlmProvider,
  discoverModels,
  getLlmProviders,
  updateLlmProvider,
} from '@/lib/endpoints'
import type { LlmProviderKind, LlmProviderResponse } from '@/types/api'

const PROVIDER_LABEL: Record<LlmProviderKind, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (local)',
}

export function LlmProvidersTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<LlmProviderResponse | null>(null)
  const [deleting, setDeleting] = React.useState<LlmProviderResponse | null>(null)
  const queryClient = useQueryClient()

  const { data: providers, isLoading } = useQuery({
    queryKey: ['llm-providers', accountId],
    queryFn: () => getLlmProviders(accountId),
  })

  const activate = useMutation({
    mutationFn: (providerId: string) => activateLlmProvider(accountId, providerId),
    onSuccess: () => {
      toast.success('Proveedor activado', {
        description: 'El bot de esta cuenta usa este modelo desde ahora.',
      })
      queryClient.invalidateQueries({ queryKey: ['llm-providers', accountId] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo activar'),
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Proveedor LLM</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Qué modelo usa el agente de esta cuenta. Sin un proveedor activo, se usa el modelo
            por defecto de la plataforma.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nuevo proveedor
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {providers?.length === 0 && (
        <EmptyState
          icon={Cpu}
          title="Todavía no hay proveedores configurados"
          description="Sin uno activo, el agente usa el modelo por defecto de la plataforma."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              Crear el primero
            </Button>
          }
        />
      )}

      {providers && providers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-px pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4 font-medium">{p.name}</TableCell>
                  <TableCell>{PROVIDER_LABEL[p.provider]}</TableCell>
                  <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                    {p.model}
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge>Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1.5">
                      {!p.is_active && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={activate.isPending}
                          onClick={() => activate.mutate(p.id)}
                        >
                          Activar
                        </Button>
                      )}
                      <Button variant="ghost" size="xs" title="Editar" onClick={() => setEditing(p)}>
                        <Pencil />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Eliminar"
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 />
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateProviderDialog accountId={accountId} open={creating} onOpenChange={setCreating} />
      <EditProviderDialog
        accountId={accountId}
        provider={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteProviderDialog
        accountId={accountId}
        provider={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </section>
  )
}

function ModelDiscoveryField({
  provider,
  baseUrl,
  apiKey,
  model,
  onModelChange,
  accountId,
}: {
  provider: LlmProviderKind
  baseUrl: string
  apiKey: string
  model: string
  onModelChange: (model: string) => void
  accountId: string
}) {
  const [models, setModels] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)

  const discover = useMutation({
    mutationFn: () =>
      discoverModels(accountId, {
        provider,
        base_url: baseUrl.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      }),
    onSuccess: (data) => {
      setModels(data.models)
      setError(null)
      if (data.models.length && !data.models.includes(model)) onModelChange(data.models[0])
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudieron listar modelos'),
  })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="provider-model">Modelo</Label>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={discover.isPending}
          onClick={() => discover.mutate()}
        >
          <Sparkles />
          Descubrir modelos
        </Button>
      </div>
      {models.length > 0 ? (
        <Select id="provider-model" value={model} onChange={(e) => onModelChange(e.target.value)}>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id="provider-model"
          required
          className="font-mono"
          placeholder="gpt-4o, claude-sonnet-4-5, ..."
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function CreateProviderDialog({
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
      queryClient.invalidateQueries({ queryKey: ['llm-providers', accountId] })
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

function EditProviderDialog({
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
      queryClient.invalidateQueries({ queryKey: ['llm-providers', accountId] })
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

function DeleteProviderDialog({
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
      queryClient.invalidateQueries({ queryKey: ['llm-providers', accountId] })
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

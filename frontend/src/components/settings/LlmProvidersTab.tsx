import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cpu, Pencil, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { queryKeys } from '@/lib/queryKeys'
import { activateLlmProvider, getLlmProviders } from '@/lib/endpoints'
import type { LlmProviderResponse } from '@/types/api'

import { CreateProviderDialog } from './providers/CreateProviderDialog'
import { DeleteProviderDialog } from './providers/DeleteProviderDialog'
import { EditProviderDialog } from './providers/EditProviderDialog'
import { PROVIDER_LABEL } from './providers/providerFormConstants'

export function LlmProvidersTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<LlmProviderResponse | null>(null)
  const [deleting, setDeleting] = React.useState<LlmProviderResponse | null>(null)
  const queryClient = useQueryClient()

  const { data: providers, isLoading } = useQuery({
    queryKey: queryKeys.llmProviders(accountId),
    queryFn: () => getLlmProviders(accountId),
  })

  const activate = useMutation({
    mutationFn: (providerId: string) => activateLlmProvider(accountId, providerId),
    onSuccess: () => {
      toast.success('Proveedor activado', {
        description: 'El bot de esta cuenta usa este modelo desde ahora.',
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders(accountId) })
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

import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import * as React from 'react'

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
import { getTools } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { ToolAdminResponse } from '@/types/api'

import { CreateToolDialog } from './tools/CreateToolDialog'
import { DeleteToolDialog } from './tools/DeleteToolDialog'
import { EditToolDialog } from './tools/EditToolDialog'

export function ToolsTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<ToolAdminResponse | null>(null)
  const [deleting, setDeleting] = React.useState<ToolAdminResponse | null>(null)

  const { data: tools, isLoading } = useQuery({
    queryKey: queryKeys.tools(accountId),
    queryFn: () => getTools(accountId),
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Herramientas</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Tools http (API externa), sql (solo lectura) o document (un documento de texto, sin
            embeddings) que el agente puede decidir llamar. Antes esto era un JSON local y un
            script.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nueva herramienta
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {tools?.length === 0 && (
        <EmptyState
          icon={Wrench}
          title="Todavía no hay herramientas"
          description="Sin tools configurables, el agente solo cuenta con escalar_a_humano y la base de conocimiento."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              Crear la primera
            </Button>
          }
        />
      )}

      {tools && tools.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-px pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => (
                <TableRow key={tool.id}>
                  <TableCell className="pl-4 font-mono text-[12.5px] font-medium">
                    {tool.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tool.kind}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {tool.description}
                  </TableCell>
                  <TableCell>
                    {tool.enabled ? (
                      <Badge>Habilitada</Badge>
                    ) : (
                      <Badge variant="secondary">Deshabilitada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Editar"
                        onClick={() => setEditing(tool)}
                      >
                        <Pencil />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Eliminar"
                        onClick={() => setDeleting(tool)}
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

      <CreateToolDialog accountId={accountId} open={creating} onOpenChange={setCreating} />
      <EditToolDialog
        accountId={accountId}
        tool={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteToolDialog
        accountId={accountId}
        tool={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </section>
  )
}

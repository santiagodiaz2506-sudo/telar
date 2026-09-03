import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { createTool, deleteTool, getTools, updateTool } from '@/lib/endpoints'
import type { ToolAdminResponse, ToolKind } from '@/types/api'

const CONFIG_PLACEHOLDER: Record<ToolKind, string> = {
  http: '{\n  "url": "https://api.tuempresa.com/pedidos",\n  "method": "GET",\n  "timeout_seconds": 10\n}',
  sql: '{\n  "query": "SELECT * FROM pedidos WHERE id = %(order_id)s"\n}',
  document: '', // document no usa este campo -- ver DOCUMENT_TEXT_PLACEHOLDER
}

const SECRET_PLACEHOLDER: Record<ToolKind, string> = {
  http: '{\n  "headers": {"Authorization": "Bearer ..."}\n}',
  sql: '{\n  "connection_string": "postgresql://..."\n}',
  document: '', // document no tiene secreto: no llama a nada externo
}

const DOCUMENT_TEXT_PLACEHOLDER =
  'Pegá acá el contenido -- preguntas frecuentes, políticas, catálogo en texto plano...'

const KIND_HINT: Record<ToolKind, string> = {
  http: 'Llama una API externa que ya tenés.',
  sql: 'Consulta tu propia base de datos, siempre de solo lectura.',
  document: 'Un documento de referencia. Sin embeddings ni proveedor de LLM externo.',
}

const SCHEMA_PLACEHOLDER =
  '{\n  "properties": {\n    "order_id": {"type": "string", "description": "número de pedido"}\n  },\n  "required": ["order_id"]\n}'

interface ToolTemplate {
  key: string
  label: string
  name: string
  description: string
  config: Record<string, unknown>
  schema: Record<string, unknown>
  secret: Record<string, unknown>
}

/**
 * Plantillas de arranque rápido -- apuntan a URLs de ejemplo, claramente falsas.
 * La idea es no partir de un textarea vacío: se elige una, se reemplaza la URL
 * (y el token) por los reales, y ya queda una tool http andando.
 */
const TOOL_TEMPLATES: ToolTemplate[] = [
  {
    key: 'consultar_estado_pedido',
    label: 'Estado de pedido',
    name: 'consultar_estado_pedido',
    description: 'Busca el estado de un pedido por su número.',
    config: { url: 'https://api.tu-erp.com/pedidos', method: 'GET', timeout_seconds: 10 },
    schema: {
      properties: { order_id: { type: 'string', description: 'número de pedido' } },
      required: ['order_id'],
    },
    secret: { headers: { Authorization: 'Bearer TU_TOKEN_AQUI' } },
  },
  {
    key: 'consultar_disponibilidad',
    label: 'Consultar disponibilidad',
    name: 'consultar_disponibilidad',
    description: 'Consulta los horarios disponibles para agendar una cita en una fecha dada.',
    config: { url: 'https://api.tu-calendario.com/disponibilidad', method: 'GET', timeout_seconds: 10 },
    schema: {
      properties: { fecha: { type: 'string', description: 'fecha a consultar, formato YYYY-MM-DD' } },
      required: ['fecha'],
    },
    secret: { headers: { Authorization: 'Bearer TU_TOKEN_AQUI' } },
  },
  {
    key: 'agendar_cita',
    label: 'Agendar cita',
    name: 'agendar_cita',
    description: 'Agenda una cita en la fecha y hora indicadas.',
    config: { url: 'https://api.tu-calendario.com/citas', method: 'POST', timeout_seconds: 10 },
    schema: {
      properties: {
        fecha: { type: 'string', description: 'fecha, formato YYYY-MM-DD' },
        hora: { type: 'string', description: 'hora, formato HH:MM' },
        nombre_cliente: { type: 'string', description: 'nombre de quien agenda' },
      },
      required: ['fecha', 'hora', 'nombre_cliente'],
    },
    secret: { headers: { Authorization: 'Bearer TU_TOKEN_AQUI' } },
  },
]

function parseJsonField(raw: string, label: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new Error(`${label} no es un JSON válido (tiene que ser un objeto, ej. {"clave": "valor"})`)
  }
}

export function ToolsTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<ToolAdminResponse | null>(null)
  const [deleting, setDeleting] = React.useState<ToolAdminResponse | null>(null)

  const { data: tools, isLoading } = useQuery({
    queryKey: ['tools', accountId],
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

function CreateToolDialog({
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
  const [description, setDescription] = React.useState('')
  const [kind, setKind] = React.useState<ToolKind>('http')
  const [config, setConfig] = React.useState('')
  const [schema, setSchema] = React.useState('')
  const [secret, setSecret] = React.useState('')
  const [documentText, setDocumentText] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const isDocument = kind === 'document'

  function reset() {
    setName('')
    setDescription('')
    setKind('http')
    setConfig('')
    setSchema('')
    setSecret('')
    setDocumentText('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function applyTemplate(template: ToolTemplate) {
    setKind('http')
    setName(template.name)
    setDescription(template.description)
    setConfig(JSON.stringify(template.config, null, 2))
    setSchema(JSON.stringify(template.schema, null, 2))
    setSecret(JSON.stringify(template.secret, null, 2))
    setDocumentText('')
    setError(null)
  }

  const create = useMutation({
    mutationFn: () => {
      if (isDocument) {
        if (!documentText.trim()) throw new Error('Pegá el contenido del documento')
        return createTool(accountId, {
          name: name.trim(),
          description: description.trim(),
          kind,
          config: { text: documentText },
        })
      }
      const parsedConfig = parseJsonField(config, 'La configuración')
      if (!parsedConfig) throw new Error('La configuración es obligatoria')
      const parsedSchema = parseJsonField(schema, 'El schema')
      const parsedSecret = parseJsonField(secret, 'El secreto')
      return createTool(accountId, {
        name: name.trim(),
        description: description.trim(),
        kind,
        config: parsedConfig,
        schema: parsedSchema,
        secret: parsedSecret,
      })
    },
    onSuccess: () => {
      toast.success('Herramienta creada', {
        description: 'Ya está disponible para el agente.',
      })
      queryClient.invalidateQueries({ queryKey: ['tools', accountId] })
      reset()
      onOpenChange(false)
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'No se pudo crear la herramienta'),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva herramienta</DialogTitle>
          <DialogDescription>
            El tipo no se puede cambiar después de crearla. sql siempre corre en modo solo lectura.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-surface-2/50 p-3">
          <p className="text-xs font-medium text-foreground">Empezar desde una plantilla</p>
          <div className="flex flex-wrap gap-1.5">
            {TOOL_TEMPLATES.map((template) => (
              <Button
                key={template.key}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => applyTemplate(template)}
              >
                {template.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Llenan el formulario con una URL de ejemplo -- reemplazá la URL y el token por los
            reales antes de crear la herramienta.
          </p>
        </div>
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
              <Label htmlFor="tool-name">Nombre</Label>
              <Input
                id="tool-name"
                required
                autoFocus
                className="font-mono"
                placeholder="consultar_pedido"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tool-kind">Tipo</Label>
              <Select id="tool-kind" value={kind} onChange={(e) => setKind(e.target.value as ToolKind)}>
                <option value="http">http — API externa</option>
                <option value="sql">sql — solo lectura</option>
                <option value="document">document — un documento, sin embeddings</option>
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tool-description">Descripción</Label>
            <Textarea
              id="tool-description"
              required
              placeholder="Busca el estado de un pedido por su número."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Esto es lo que el modelo lee para decidir cuándo llamarla. Sé específico.
            </p>
          </div>
          {isDocument ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tool-document-text">Contenido del documento</Label>
              <Textarea
                id="tool-document-text"
                required
                className="min-h-40 text-[13px]"
                placeholder={DOCUMENT_TEXT_PLACEHOLDER}
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Texto plano, sin JSON. El agente lo lee tal cual -- sin buscar por similitud ni
                depender de otro proveedor de LLM. Para documentos muy largos (varios cientos de
                páginas) conviene una base de conocimiento en cambio.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tool-config">Config (JSON)</Label>
                <Textarea
                  id="tool-config"
                  required
                  className="font-mono text-[12.5px]"
                  placeholder={CONFIG_PLACEHOLDER[kind]}
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tool-schema">Schema de parámetros (JSON, opcional)</Label>
                <Textarea
                  id="tool-schema"
                  className="font-mono text-[12.5px]"
                  placeholder={SCHEMA_PLACEHOLDER}
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tool-secret">Secreto (JSON, opcional)</Label>
                <Textarea
                  id="tool-secret"
                  className="font-mono text-[12.5px]"
                  placeholder={SECRET_PLACEHOLDER[kind]}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se cifra antes de guardarse; no vuelve a mostrarse tal cual.
                </p>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                create.isPending ||
                !name.trim() ||
                !description.trim() ||
                (isDocument ? !documentText.trim() : !config.trim())
              }
            >
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditToolDialog({
  accountId,
  tool,
  onOpenChange,
}: {
  accountId: string
  tool: ToolAdminResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [config, setConfig] = React.useState('')
  const [schema, setSchema] = React.useState('')
  const [secret, setSecret] = React.useState('')
  const [documentText, setDocumentText] = React.useState('')
  const [enabled, setEnabled] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const isDocument = tool?.kind === 'document'

  React.useEffect(() => {
    if (tool) {
      setName(tool.name)
      setDescription(tool.description)
      setConfig(JSON.stringify(tool.config, null, 2))
      setSchema(tool.schema ? JSON.stringify(tool.schema, null, 2) : '')
      setSecret('')
      setDocumentText(typeof tool.config.text === 'string' ? tool.config.text : '')
      setEnabled(tool.enabled)
      setError(null)
    }
  }, [tool])

  const update = useMutation({
    mutationFn: () => {
      if (isDocument) {
        if (!documentText.trim()) throw new Error('El documento no puede quedar vacío')
        return updateTool(accountId, tool!.id, {
          name: name.trim(),
          description: description.trim(),
          config: { text: documentText },
          enabled,
        })
      }
      const parsedConfig = parseJsonField(config, 'La configuración')
      if (!parsedConfig) throw new Error('La configuración es obligatoria')
      const parsedSchema = parseJsonField(schema, 'El schema')
      const parsedSecret = secret.trim() ? parseJsonField(secret, 'El secreto') : undefined
      return updateTool(accountId, tool!.id, {
        name: name.trim(),
        description: description.trim(),
        config: parsedConfig,
        schema: parsedSchema,
        enabled,
        secret: parsedSecret,
      })
    },
    onSuccess: () => {
      toast.success('Herramienta actualizada', {
        description: 'El cambio ya está disponible para el agente.',
      })
      queryClient.invalidateQueries({ queryKey: ['tools', accountId] })
      onOpenChange(false)
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'No se pudo actualizar'),
  })

  return (
    <Dialog open={!!tool} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {tool?.name}</DialogTitle>
          <DialogDescription>
            Tipo: <span className="font-mono">{tool?.kind}</span> — no se puede cambiar acá.
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
            <Label htmlFor="edit-tool-name">Nombre</Label>
            <Input
              id="edit-tool-name"
              required
              autoFocus
              className="font-mono"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tool-description">Descripción</Label>
            <Textarea
              id="edit-tool-description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {isDocument ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tool-document-text">Contenido del documento</Label>
              <Textarea
                id="edit-tool-document-text"
                required
                className="min-h-40 text-[13px]"
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-tool-config">Config (JSON)</Label>
                <Textarea
                  id="edit-tool-config"
                  required
                  className="font-mono text-[12.5px]"
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-tool-schema">Schema de parámetros (JSON, opcional)</Label>
                <Textarea
                  id="edit-tool-schema"
                  className="font-mono text-[12.5px]"
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-tool-secret">Secreto nuevo (JSON, opcional)</Label>
                <Textarea
                  id="edit-tool-secret"
                  className="font-mono text-[12.5px]"
                  placeholder="Dejar vacío para no cambiar el secreto guardado"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-border-strong"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Habilitada
          </label>

          {error && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                update.isPending ||
                !name.trim() ||
                !description.trim() ||
                (isDocument ? !documentText.trim() : !config.trim())
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteToolDialog({
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
      queryClient.invalidateQueries({ queryKey: ['tools', accountId] })
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

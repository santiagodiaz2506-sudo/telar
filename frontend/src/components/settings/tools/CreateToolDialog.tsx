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
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { createTool } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { ToolKind } from '@/types/api'

import {
  CONFIG_PLACEHOLDER,
  DOCUMENT_TEXT_PLACEHOLDER,
  KIND_HINT,
  parseJsonField,
  SCHEMA_PLACEHOLDER,
  SECRET_PLACEHOLDER,
  TOOL_TEMPLATES,
  type ToolTemplate,
} from './toolFormConstants'

export function CreateToolDialog({
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tools(accountId) })
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

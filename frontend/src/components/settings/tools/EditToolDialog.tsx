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
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { updateTool } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { ToolAdminResponse } from '@/types/api'

import { parseJsonField } from './toolFormConstants'

export function EditToolDialog({
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tools(accountId) })
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

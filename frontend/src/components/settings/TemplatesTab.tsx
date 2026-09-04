import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Trash2 } from 'lucide-react'
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
import { createTemplate, deleteTemplate, getTemplates } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import type { TemplateComponent, TemplateResponse } from '@/types/api'

const COMPONENTS_PLACEHOLDER =
  '[\n  {"type": "BODY", "text": "Hola {{1}}, tu pedido está en camino."}\n]'

function bodyPreview(components: TemplateComponent[]): string {
  const body = components.find((c) => c.type === 'BODY')
  return body?.text ?? components[0]?.text ?? '—'
}

function parseComponents(raw: string): TemplateComponent[] {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Los componentes son obligatorios')
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('Los componentes no son un JSON válido')
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      'Los componentes tienen que ser una lista, ej. [{"type": "BODY", "text": "..."}]',
    )
  }
  return parsed as TemplateComponent[]
}

export function TemplatesTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<TemplateResponse | null>(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.templates(accountId),
    queryFn: () => getTemplates(accountId),
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Plantillas de WhatsApp</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Es lo único que Meta deja usar para escribirle primero a un contacto, o para
            reabrir una conversación fuera de la ventana de 24 horas. Tienen que estar
            aprobadas de antemano en Meta Business Manager -- acá solo se registran para que
            Telar sepa que existen.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nueva plantilla
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {templates?.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Todavía no hay plantillas"
          description="Sin ninguna registrada, no hay forma de reabrir una conversación cerrada ni de escribirle primero a un contacto."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              Registrar la primera
            </Button>
          }
        />
      )}

      {templates && templates.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead>Idioma</TableHead>
                <TableHead>Contenido</TableHead>
                <TableHead className="w-px pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="pl-4 font-mono text-[12.5px] font-medium">
                    {template.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{template.language}</Badge>
                  </TableCell>
                  <TableCell className="max-w-sm truncate text-muted-foreground">
                    {bodyPreview(template.components)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Eliminar"
                        onClick={() => setDeleting(template)}
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

      <CreateTemplateDialog accountId={accountId} open={creating} onOpenChange={setCreating} />
      <DeleteTemplateDialog
        accountId={accountId}
        template={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </section>
  )
}

function CreateTemplateDialog({
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
  const [language, setLanguage] = React.useState('es')
  const [components, setComponents] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  function reset() {
    setName('')
    setLanguage('es')
    setComponents('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const create = useMutation({
    mutationFn: () => {
      const parsedComponents = parseComponents(components)
      return createTemplate(accountId, {
        name: name.trim(),
        language: language.trim() || 'es',
        components: parsedComponents,
      })
    },
    onSuccess: () => {
      toast.success('Plantilla registrada')
      queryClient.invalidateQueries({ queryKey: queryKeys.templates(accountId) })
      reset()
      onOpenChange(false)
    },
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'No se pudo registrar la plantilla',
      ),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva plantilla</DialogTitle>
          <DialogDescription>
            Registrá acá exactamente la plantilla que ya aprobó Meta -- el nombre, el idioma y
            los componentes tienen que coincidir con lo que ves en Meta Business Manager.
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
              <Label htmlFor="template-name">Nombre</Label>
              <Input
                id="template-name"
                required
                autoFocus
                className="font-mono"
                placeholder="confirmacion_pedido"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El nombre exacto que aprobó Meta (minúsculas y guiones bajos).
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-language">Idioma</Label>
              <Input
                id="template-language"
                required
                className="font-mono"
                placeholder="es"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Código tal como lo aprobó Meta, ej. es, es_MX, en_US.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-components">Componentes (JSON)</Label>
            <Textarea
              id="template-components"
              required
              className="min-h-32 font-mono text-[12.5px]"
              placeholder={COMPONENTS_PLACEHOLDER}
              value={components}
              onChange={(e) => setComponents(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Una lista de componentes tal como los definiste en Meta. Un componente con{' '}
              <code className="font-mono">{'{{1}}'}</code>, <code className="font-mono">{'{{2}}'}</code>{' '}
              ... en su texto queda con variables reemplazables al enviarla.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTemplateDialog({
  accountId,
  template,
  onOpenChange,
}: {
  accountId: string
  template: TemplateResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: () => deleteTemplate(accountId, template!.id),
    onSuccess: () => {
      toast.success('Plantilla eliminada')
      queryClient.invalidateQueries({ queryKey: queryKeys.templates(accountId) })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar'),
  })

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {template?.name}</DialogTitle>
          <DialogDescription>
            Deja de poder usarse desde Telar para reabrir conversaciones o escribir primero.
            Esto no borra la plantilla de Meta, solo el registro acá. Esta acción no se puede
            deshacer.
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

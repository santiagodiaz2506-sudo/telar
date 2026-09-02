import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Trash2, Upload } from 'lucide-react'
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
import { ApiError } from '@/lib/api'
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBases,
  ingestDocument,
} from '@/lib/endpoints'
import type { KnowledgeBaseResponse } from '@/types/api'

export function KnowledgeBasesTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<KnowledgeBaseResponse | null>(null)

  const { data: kbs, isLoading } = useQuery({
    queryKey: ['knowledge-bases', accountId],
    queryFn: () => getKnowledgeBases(accountId),
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Bases de conocimiento</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            El agente busca por similitud semántica antes de responder, cuando decide que hace
            falta. Ingestar un archivo lo fragmenta y calcula sus embeddings.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nueva base
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {kbs?.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="Todavía no hay bases de conocimiento"
          description="Sin una base, consultar_base_de_conocimiento no tiene nada donde buscar."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              Crear la primera
            </Button>
          }
        />
      )}

      {kbs && kbs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead>Modelo de embedding</TableHead>
                <TableHead>Dimensiones</TableHead>
                <TableHead className="w-px pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {kbs.map((kb) => (
                <KnowledgeBaseRow key={kb.id} accountId={accountId} kb={kb} onDelete={() => setDeleting(kb)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateKnowledgeBaseDialog accountId={accountId} open={creating} onOpenChange={setCreating} />
      <DeleteKnowledgeBaseDialog
        accountId={accountId}
        kb={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </section>
  )
}

function KnowledgeBaseRow({
  accountId,
  kb,
  onDelete,
}: {
  accountId: string
  kb: KnowledgeBaseResponse
  onDelete: () => void
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const ingest = useMutation({
    mutationFn: (file: File) => ingestDocument(accountId, kb.id, file),
    onSuccess: (res) => {
      toast.success('Documento ingerido', {
        description: `${res.chunks_inserted} fragmentos agregados a "${kb.name}".`,
      })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo ingerir el archivo'),
  })

  return (
    <TableRow>
      <TableCell className="pl-4 font-medium">{kb.name}</TableCell>
      <TableCell className="font-mono text-[12.5px] text-muted-foreground">
        {kb.embedding_model}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <Badge variant="outline">{kb.dimensions}</Badge>
      </TableCell>
      <TableCell className="pr-4">
        <div className="flex justify-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) ingest.mutate(file)
              e.target.value = ''
            }}
          />
          <Button
            variant="ghost"
            size="xs"
            title="Ingestar documento"
            disabled={ingest.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload />
            {ingest.isPending ? 'Subiendo…' : 'Ingestar'}
          </Button>
          <Button variant="ghost" size="xs" title="Eliminar" onClick={onDelete}>
            <Trash2 />
            Eliminar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function CreateKnowledgeBaseDialog({
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
  const [error, setError] = React.useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName('')
      setError(null)
    }
    onOpenChange(next)
  }

  const create = useMutation({
    mutationFn: () => createKnowledgeBase(accountId, name.trim()),
    onSuccess: () => {
      toast.success('Base de conocimiento creada')
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases', accountId] })
      handleOpenChange(false)
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo crear la base'),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva base de conocimiento</DialogTitle>
          <DialogDescription>
            El embedding queda fijo en text-embedding-3-small (1536 dimensiones) para todo el v0.
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kb-name">Nombre</Label>
            <Input
              id="kb-name"
              required
              autoFocus
              placeholder="FAQ"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
            <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteKnowledgeBaseDialog({
  accountId,
  kb,
  onOpenChange,
}: {
  accountId: string
  kb: KnowledgeBaseResponse | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: () => deleteKnowledgeBase(accountId, kb!.id),
    onSuccess: () => {
      toast.success('Base de conocimiento eliminada')
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases', accountId] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar'),
  })

  return (
    <Dialog open={!!kb} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {kb?.name}</DialogTitle>
          <DialogDescription>
            Se borran también todos sus fragmentos ingeridos. Esta acción no se puede deshacer.
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

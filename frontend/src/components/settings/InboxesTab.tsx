import { useQuery } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus, RadioTower } from 'lucide-react'
import * as React from 'react'

import { EmptyState } from '@/components/EmptyState'
import {
  CreateInboxForm,
  EditInboxForm,
  RotateCredentialsForm,
} from '@/components/InboxConnectionForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getInboxes, getTeams } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import { shortTimestamp } from '@/lib/format'
import type { InboxResponse } from '@/types/api'

export function InboxesTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<InboxResponse | null>(null)
  const [rotating, setRotating] = React.useState<InboxResponse | null>(null)

  const { data: inboxes, isLoading } = useQuery({
    queryKey: queryKeys.inboxes(accountId),
    queryFn: () => getInboxes(accountId),
  })

  const { data: teams } = useQuery({
    queryKey: queryKeys.teams(accountId),
    queryFn: () => getTeams(accountId),
  })

  const teamName = (teamId: string | null) =>
    teamId ? (teams?.find((t) => t.id === teamId)?.name ?? 'Equipo eliminado') : '—'

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Inboxes</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Los números de WhatsApp de la cuenta. Antes esto era un INSERT a mano.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nuevo inbox
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {inboxes?.length === 0 && (
        <EmptyState
          icon={RadioTower}
          title="Todavía no hay inboxes"
          description="Sin un número de WhatsApp registrado, Telar no tiene a dónde mandar ni de dónde recibir mensajes."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              Crear el primero
            </Button>
          }
        />
      )}

      {inboxes && inboxes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead>phone_number_id</TableHead>
                <TableHead>waba_id</TableHead>
                <TableHead>Equipo por defecto</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="w-px pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {inboxes.map((inbox) => (
                <TableRow key={inbox.id}>
                  <TableCell className="pl-4 font-medium">{inbox.name}</TableCell>
                  <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                    {inbox.phone_number_id ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                    {inbox.waba_id ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {teamName(inbox.default_team_id)}
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {shortTimestamp(inbox.created_at)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Editar"
                        onClick={() => setEditing(inbox)}
                      >
                        <Pencil />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Rotar credenciales"
                        onClick={() => setRotating(inbox)}
                      >
                        <KeyRound />
                        Credenciales
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateInboxDialog accountId={accountId} open={creating} onOpenChange={setCreating} />
      <EditInboxDialog
        accountId={accountId}
        inbox={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <RotateCredentialsDialog
        accountId={accountId}
        inbox={rotating}
        onOpenChange={(open) => !open && setRotating(null)}
      />
    </section>
  )
}

function CreateInboxDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo inbox</DialogTitle>
          <DialogDescription>
            El access token se cifra antes de guardarse; no vuelve a mostrarse tal cual.
          </DialogDescription>
        </DialogHeader>
        <CreateInboxForm
          accountId={accountId}
          open={open}
          successMessage="Inbox creado"
          onSuccess={() => onOpenChange(false)}
          renderActions={({ pending, canSubmit }) => (
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={pending || !canSubmit}>
                Crear
              </Button>
            </DialogFooter>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditInboxDialog({
  accountId,
  inbox,
  onOpenChange,
}: {
  accountId: string
  inbox: InboxResponse | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!inbox} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {inbox?.name}</DialogTitle>
          <DialogDescription>El número y el token no se tocan acá.</DialogDescription>
        </DialogHeader>
        {inbox && (
          <EditInboxForm
            accountId={accountId}
            inbox={inbox}
            successMessage="Inbox actualizado"
            onSuccess={() => onOpenChange(false)}
            renderActions={({ pending, canSubmit }) => (
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={pending || !canSubmit}>
                  Guardar
                </Button>
              </DialogFooter>
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RotateCredentialsDialog({
  accountId,
  inbox,
  onOpenChange,
}: {
  accountId: string
  inbox: InboxResponse | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!inbox} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotar credenciales de {inbox?.name}</DialogTitle>
          <DialogDescription>
            Reemplaza el número, el waba_id y el token juntos -- no es un ajuste parcial.
          </DialogDescription>
        </DialogHeader>
        {inbox && (
          <RotateCredentialsForm
            accountId={accountId}
            inbox={inbox}
            onSuccess={() => onOpenChange(false)}
            renderActions={({ pending, canSubmit }) => (
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={pending || !canSubmit}>
                  Rotar
                </Button>
              </DialogFooter>
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

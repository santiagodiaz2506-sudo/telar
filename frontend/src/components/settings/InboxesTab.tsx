import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus, RadioTower } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
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
  createInbox,
  getInboxes,
  getTeams,
  rotateInboxCredentials,
  updateInbox,
} from '@/lib/endpoints'
import { shortTimestamp } from '@/lib/format'
import type { InboxResponse } from '@/types/api'

export function InboxesTab({ accountId }: { accountId: string }) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<InboxResponse | null>(null)
  const [rotating, setRotating] = React.useState<InboxResponse | null>(null)

  const { data: inboxes, isLoading } = useQuery({
    queryKey: ['inboxes', accountId],
    queryFn: () => getInboxes(accountId),
  })

  const { data: teams } = useQuery({
    queryKey: ['teams', accountId],
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

function TeamSelect({
  accountId,
  value,
  onChange,
}: {
  accountId: string
  value: string
  onChange: (value: string) => void
}) {
  const { data: teams } = useQuery({ queryKey: ['teams', accountId], queryFn: () => getTeams(accountId) })

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin equipo por defecto</option>
      {teams?.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
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
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [phoneNumberId, setPhoneNumberId] = React.useState('')
  const [wabaId, setWabaId] = React.useState('')
  const [accessToken, setAccessToken] = React.useState('')
  const [defaultTeamId, setDefaultTeamId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  function reset() {
    setName('')
    setPhoneNumberId('')
    setWabaId('')
    setAccessToken('')
    setDefaultTeamId('')
    setError(null)
  }

  const create = useMutation({
    mutationFn: () =>
      createInbox(accountId, {
        name: name.trim(),
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || undefined,
        access_token: accessToken.trim(),
        default_team_id: defaultTeamId || undefined,
      }),
    onSuccess: () => {
      toast.success('Inbox creado')
      queryClient.invalidateQueries({ queryKey: ['inboxes', accountId] })
      reset()
      onOpenChange(false)
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo crear el inbox'),
  })

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo inbox</DialogTitle>
          <DialogDescription>
            El access token se cifra antes de guardarse; no vuelve a mostrarse tal cual.
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
            <Label htmlFor="inbox-name">Nombre</Label>
            <Input
              id="inbox-name"
              required
              autoFocus
              placeholder="Principal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inbox-phone-id">phone_number_id</Label>
            <Input
              id="inbox-phone-id"
              required
              className="font-mono"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inbox-waba-id">waba_id (opcional)</Label>
            <Input
              id="inbox-waba-id"
              className="font-mono"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inbox-token">Access token de Meta</Label>
            <Input
              id="inbox-token"
              required
              type="password"
              className="font-mono"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inbox-team">Equipo por defecto</Label>
            <TeamSelect accountId={accountId} value={defaultTeamId} onChange={setDefaultTeamId} />
            <p className="text-xs text-muted-foreground">
              A qué equipo cae el traspaso a humano si nadie lo pide desde el bot.
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
            <Button
              type="submit"
              size="sm"
              disabled={create.isPending || !name.trim() || !phoneNumberId.trim() || !accessToken.trim()}
            >
              Crear
            </Button>
          </DialogFooter>
        </form>
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
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [defaultTeamId, setDefaultTeamId] = React.useState('')

  React.useEffect(() => {
    if (inbox) {
      setName(inbox.name)
      setDefaultTeamId(inbox.default_team_id ?? '')
    }
  }, [inbox])

  const update = useMutation({
    mutationFn: () =>
      updateInbox(accountId, inbox!.id, {
        name: name.trim(),
        default_team_id: defaultTeamId || null,
      }),
    onSuccess: () => {
      toast.success('Inbox actualizado')
      queryClient.invalidateQueries({ queryKey: ['inboxes', accountId] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  })

  return (
    <Dialog open={!!inbox} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {inbox?.name}</DialogTitle>
          <DialogDescription>El número y el token no se tocan acá.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-inbox-name">Nombre</Label>
            <Input
              id="edit-inbox-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-inbox-team">Equipo por defecto</Label>
            <TeamSelect accountId={accountId} value={defaultTeamId} onChange={setDefaultTeamId} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending || !name.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
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
  const queryClient = useQueryClient()
  const [phoneNumberId, setPhoneNumberId] = React.useState('')
  const [wabaId, setWabaId] = React.useState('')
  const [accessToken, setAccessToken] = React.useState('')

  React.useEffect(() => {
    if (inbox) {
      setPhoneNumberId(inbox.phone_number_id ?? '')
      setWabaId(inbox.waba_id ?? '')
      setAccessToken('')
    }
  }, [inbox])

  const rotate = useMutation({
    mutationFn: () =>
      rotateInboxCredentials(accountId, inbox!.id, {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || undefined,
        access_token: accessToken.trim(),
      }),
    onSuccess: () => {
      toast.success('Credenciales actualizadas')
      queryClient.invalidateQueries({ queryKey: ['inboxes', accountId] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo rotar credenciales'),
  })

  return (
    <Dialog open={!!inbox} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotar credenciales de {inbox?.name}</DialogTitle>
          <DialogDescription>
            Reemplaza el número, el waba_id y el token juntos -- no es un ajuste parcial.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            rotate.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rotate-phone-id">phone_number_id</Label>
            <Input
              id="rotate-phone-id"
              required
              autoFocus
              className="font-mono"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rotate-waba-id">waba_id (opcional)</Label>
            <Input
              id="rotate-waba-id"
              className="font-mono"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rotate-token">Access token nuevo</Label>
            <Input
              id="rotate-token"
              required
              type="password"
              className="font-mono"
              placeholder="El token vigente no se muestra"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={rotate.isPending || !phoneNumberId.trim() || !accessToken.trim()}
            >
              Rotar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

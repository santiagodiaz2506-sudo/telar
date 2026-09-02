import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, RadioTower, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { createInbox, getTeams, rotateInboxCredentials, updateInbox } from '@/lib/endpoints'
import type { InboxResponse } from '@/types/api'

interface Props {
  accountId: string
  inboxes: InboxResponse[]
  onClose: () => void
}

/**
 * Panel del nodo de inicio del hilo: la misma conexión de WhatsApp que
 * InboxesTab.tsx (Configuración), pero editable ahí mismo en el lienzo.
 * Con más de un inbox, este panel solo muestra/edita el primero y manda al
 * resto a Configuración -- no duplica ese CRUD acá.
 */
export function InboxConnectionPanel({ accountId, inboxes, onClose }: Props) {
  const primary = inboxes[0] as InboxResponse | undefined
  const extraCount = Math.max(inboxes.length - 1, 0)

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-border bg-surface">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <RadioTower className="size-4 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">Conexión de WhatsApp</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar panel">
          <X />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {primary ? (
          <ConnectedForm accountId={accountId} inbox={primary} />
        ) : (
          <ConnectForm accountId={accountId} />
        )}

        {extraCount > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            +{extraCount} {extraCount === 1 ? 'inbox más' : 'inboxes más'} en esta cuenta.{' '}
            <Link
              to={`/accounts/${accountId}/settings`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Gestionarlos en Configuración
            </Link>
          </p>
        )}

        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
          El hilo se dispara con cada mensaje nuevo que llega por este número. Los webhooks de
          estado (entregado, leído) se ignoran automáticamente -- no hay otros eventos para
          elegir todavía.
        </p>
      </div>
    </aside>
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
  const { data: teams } = useQuery({
    queryKey: ['teams', accountId],
    queryFn: () => getTeams(accountId),
  })

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

function ConnectForm({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [phoneNumberId, setPhoneNumberId] = React.useState('')
  const [wabaId, setWabaId] = React.useState('')
  const [accessToken, setAccessToken] = React.useState('')
  const [defaultTeamId, setDefaultTeamId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

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
      toast.success('WhatsApp conectado')
      queryClient.invalidateQueries({ queryKey: ['inboxes', accountId] })
      setError(null)
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo conectar'),
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        create.mutate()
      }}
    >
      <p className="text-xs text-muted-foreground">
        Todavía no hay ningún número de WhatsApp conectado a esta cuenta.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trigger-name">Nombre</Label>
        <Input
          id="trigger-name"
          required
          autoFocus
          placeholder="Principal"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trigger-phone-id">phone_number_id</Label>
        <Input
          id="trigger-phone-id"
          required
          className="font-mono"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trigger-waba-id">waba_id (opcional)</Label>
        <Input
          id="trigger-waba-id"
          className="font-mono"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trigger-token">Access token de Meta</Label>
        <Input
          id="trigger-token"
          required
          type="password"
          className="font-mono"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trigger-team">Equipo por defecto</Label>
        <TeamSelect accountId={accountId} value={defaultTeamId} onChange={setDefaultTeamId} />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        disabled={create.isPending || !name.trim() || !phoneNumberId.trim() || !accessToken.trim()}
      >
        Conectar
      </Button>
    </form>
  )
}

function ConnectedForm({ accountId, inbox }: { accountId: string; inbox: InboxResponse }) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState(inbox.name)
  const [defaultTeamId, setDefaultTeamId] = React.useState(inbox.default_team_id ?? '')
  const [rotating, setRotating] = React.useState(false)
  const [phoneNumberId, setPhoneNumberId] = React.useState(inbox.phone_number_id ?? '')
  const [wabaId, setWabaId] = React.useState(inbox.waba_id ?? '')
  const [accessToken, setAccessToken] = React.useState('')

  React.useEffect(() => {
    setName(inbox.name)
    setDefaultTeamId(inbox.default_team_id ?? '')
    setPhoneNumberId(inbox.phone_number_id ?? '')
    setWabaId(inbox.waba_id ?? '')
    setAccessToken('')
    setRotating(false)
  }, [inbox])

  const update = useMutation({
    mutationFn: () =>
      updateInbox(accountId, inbox.id, { name: name.trim(), default_team_id: defaultTeamId || null }),
    onSuccess: () => {
      toast.success('Guardado')
      queryClient.invalidateQueries({ queryKey: ['inboxes', accountId] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar'),
  })

  const rotate = useMutation({
    mutationFn: () =>
      rotateInboxCredentials(accountId, inbox.id, {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || undefined,
        access_token: accessToken.trim(),
      }),
    onSuccess: () => {
      toast.success('Credenciales actualizadas')
      queryClient.invalidateQueries({ queryKey: ['inboxes', accountId] })
      setAccessToken('')
      setRotating(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo rotar credenciales'),
  })

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conn-name">Nombre</Label>
          <Input id="conn-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conn-team">Equipo por defecto</Label>
          <TeamSelect accountId={accountId} value={defaultTeamId} onChange={setDefaultTeamId} />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={update.isPending || !name.trim()}>
          Guardar
        </Button>
      </form>

      <div className="border-t border-border pt-4">
        {!rotating ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                phone_number_id
              </span>
              <span className="font-mono text-[12.5px]">{inbox.phone_number_id ?? '—'}</span>
            </div>
            {inbox.waba_id && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  waba_id
                </span>
                <span className="font-mono text-[12.5px]">{inbox.waba_id}</span>
              </div>
            )}
            <Button variant="ghost" size="xs" className="mt-1 self-start" onClick={() => setRotating(true)}>
              <KeyRound />
              Rotar credenciales
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              rotate.mutate()
            }}
          >
            <p className="text-xs text-muted-foreground">
              Reemplaza el número, el waba_id y el token juntos.
            </p>
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
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRotating(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={rotate.isPending || !phoneNumberId.trim() || !accessToken.trim()}
              >
                Rotar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

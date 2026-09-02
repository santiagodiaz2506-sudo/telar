import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, UserPlus, Users, UsersRound } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ContactAvatar } from '@/components/ui/avatar'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  addMember,
  addTeamMember,
  createTeam,
  getMembers,
  getTeamMembers,
  getTeams,
  removeMember,
  removeTeamMember,
} from '@/lib/endpoints'
import { ASSIGNABLE_ROLES, isAdmin, isElevated, ROLE_HINT, ROLE_LABEL } from '@/lib/roles'
import type { AccountRoleValue } from '@/types/api'

export function TeamPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const { user, roleForAccount } = useAuth()
  const [tab, setTab] = React.useState<'members' | 'teams'>('members')

  if (!accountId) return null
  const role = roleForAccount(accountId)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Equipo</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'members' | 'teams')}>
          <TabsList>
            <TabsTrigger value="members">Miembros</TabsTrigger>
            <TabsTrigger value="teams">Equipos</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl">
          {tab === 'members' ? (
            <MembersTab accountId={accountId} role={role} currentUserId={user?.id} />
          ) : (
            <TeamsTab accountId={accountId} role={role} />
          )}
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Miembros de la cuenta
// --------------------------------------------------------------------------

function MembersTab({
  accountId,
  role,
  currentUserId,
}: {
  accountId: string
  role: string | null
  currentUserId?: string
}) {
  const queryClient = useQueryClient()
  const canManage = isAdmin(role)
  const [adding, setAdding] = React.useState(false)

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', accountId],
    queryFn: () => getMembers(accountId),
  })

  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(accountId, userId),
    onSuccess: () => {
      toast.success('Miembro dado de baja')
      queryClient.invalidateQueries({ queryKey: ['members', accountId] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo dar de baja'),
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Miembros de la cuenta</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Quién tiene acceso a esta bandeja y con qué permisos.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus />
            Sumar miembro
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {members && members.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Persona</TableHead>
                <TableHead>Rol</TableHead>
                {canManage && <TableHead className="w-px pr-4" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <ContactAvatar seed={m.user_id} name={m.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {m.name}
                          {m.user_id === currentUserId && (
                            <span className="ml-1.5 text-[11px] text-muted-foreground">(vos)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'administrator' ? 'default' : 'secondary'}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="pr-4 text-right">
                      {m.user_id !== currentUserId && (
                        <Button
                          variant="destructive-ghost"
                          size="xs"
                          disabled={remove.isPending}
                          title="Sacar de la cuenta"
                          onClick={() => remove.mutate(m.user_id)}
                        >
                          <Trash2 />
                          Sacar
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {members?.length === 0 && (
        <EmptyState
          icon={Users}
          title="No hay miembros todavía"
          description="Sumá gente por su correo. El usuario tiene que existir antes."
        />
      )}

      {/* El rol define qué puede hacer cada uno; que esté a la vista evita
          tener que ir al README para entenderlo. */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-2.5 text-[13px] font-medium">Qué puede hacer cada rol</p>
        <dl className="flex flex-col gap-2">
          {ASSIGNABLE_ROLES.map((r) => (
            <div key={r} className="flex gap-3 text-[13px]">
              <dt className="w-28 shrink-0 font-medium">{ROLE_LABEL[r]}</dt>
              <dd className="text-muted-foreground">{ROLE_HINT[r]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <AddMemberDialog accountId={accountId} open={adding} onOpenChange={setAdding} />
    </section>
  )
}

function AddMemberDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<AccountRoleValue>('agent')
  const [error, setError] = React.useState<string | null>(null)

  const add = useMutation({
    mutationFn: () => addMember(accountId, email.trim(), role),
    onSuccess: () => {
      toast.success('Miembro sumado a la cuenta')
      queryClient.invalidateQueries({ queryKey: ['members', accountId] })
      setEmail('')
      setError(null)
      onOpenChange(false)
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'No se pudo sumar a esta persona'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sumar miembro</DialogTitle>
          <DialogDescription>
            Todavía no hay invitación por correo: la persona ya tiene que existir como usuario.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            add.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="member-email">Correo</Label>
            <Input
              id="member-email"
              type="email"
              required
              autoFocus
              placeholder="asesor@tuempresa.com"
              value={email}
              aria-invalid={!!error}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="member-role">Rol</Label>
            <Select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AccountRoleValue)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_HINT[role]}</p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive"
            >
              <p>{error}</p>
              <code className="mt-1.5 block font-mono text-[11.5px] break-all opacity-80">
                python -m telar.auth.create_user {email || 'correo@empresa.com'} "Nombre Apellido"
              </code>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={add.isPending || !email.trim()}>
              {add.isPending && <Loader2 className="animate-spin" />}
              Sumar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --------------------------------------------------------------------------
// Equipos
// --------------------------------------------------------------------------

function TeamsTab({ accountId, role }: { accountId: string; role: string | null }) {
  const queryClient = useQueryClient()
  const canCreate = isAdmin(role)
  const canAssign = isElevated(role)
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [addingTo, setAddingTo] = React.useState<{ id: string; name: string } | null>(null)

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', accountId],
    queryFn: () => getTeams(accountId),
  })

  const create = useMutation({
    mutationFn: () => createTeam(accountId, name.trim()),
    onSuccess: () => {
      toast.success('Equipo creado')
      queryClient.invalidateQueries({ queryKey: ['teams', accountId] })
      setName('')
      setCreating(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo crear el equipo'),
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Equipos</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Agrupaciones dentro de la cuenta, para encolar los traspasos por área.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus />
            Crear equipo
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {teams?.length === 0 && (
        <EmptyState
          icon={UsersRound}
          title="No hay equipos todavía"
          description="Un equipo agrupa asesores para que las conversaciones escaladas caigan en su cola."
          action={
            canCreate ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus />
                Crear el primero
              </Button>
            ) : undefined
          }
        />
      )}

      {teams && teams.length > 0 && (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => (
            <TeamRow
              key={team.id}
              accountId={accountId}
              team={team}
              canAssign={canAssign}
              onAddClick={() => setAddingTo({ id: team.id, name: team.name })}
            />
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear equipo</DialogTitle>
            <DialogDescription>
              Por ejemplo: Soporte, Ventas, Postventa.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="team-name">Nombre</Label>
              <Input
                id="team-name"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
                {create.isPending && <Loader2 className="animate-spin" />}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddToTeamDialog
        accountId={accountId}
        team={addingTo}
        onOpenChange={(open) => !open && setAddingTo(null)}
      />
    </section>
  )
}

function TeamRow({
  accountId,
  team,
  canAssign,
  onAddClick,
}: {
  accountId: string
  team: { id: string; name: string }
  canAssign: boolean
  onAddClick: () => void
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = React.useState(false)

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members', accountId, team.id],
    queryFn: () => getTeamMembers(accountId, team.id),
    enabled: expanded,
  })

  const remove = useMutation({
    mutationFn: (userId: string) => removeTeamMember(accountId, team.id, userId),
    onSuccess: () => {
      toast.success('Sacado del equipo')
      queryClient.invalidateQueries({ queryKey: ['team-members', accountId, team.id] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo sacar del equipo'),
  })

  return (
    <li className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
          <UsersRound className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
        <Button variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
          Miembros
        </Button>
        {canAssign && (
          <Button variant="outline" size="xs" onClick={onAddClick}>
            <UserPlus />
            Sumar gente
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3.5">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-lg" />
              ))}
            </div>
          )}

          {teamMembers?.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Todavía nadie en este equipo.</p>
          )}

          {teamMembers && teamMembers.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {teamMembers.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2.5">
                  <ContactAvatar seed={m.user_id} name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {canAssign && (
                    <Button
                      variant="destructive-ghost"
                      size="xs"
                      disabled={remove.isPending}
                      title="Sacar del equipo"
                      onClick={() => remove.mutate(m.user_id)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

function AddToTeamDialog({
  accountId,
  team,
  onOpenChange,
}: {
  accountId: string
  team: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [userId, setUserId] = React.useState('')

  const { data: members } = useQuery({
    queryKey: ['members', accountId],
    queryFn: () => getMembers(accountId),
    enabled: !!team,
  })

  /* Para no ofrecer sumar a quien ya está en el equipo. */
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members', accountId, team?.id],
    queryFn: () => getTeamMembers(accountId, team!.id),
    enabled: !!team,
  })

  const availableMembers = members?.filter(
    (m) => !teamMembers?.some((tm) => tm.user_id === m.user_id),
  )

  const add = useMutation({
    mutationFn: () => addTeamMember(accountId, team!.id, userId),
    onSuccess: () => {
      toast.success(`Sumado a ${team?.name}`)
      queryClient.invalidateQueries({ queryKey: ['team-members', accountId, team?.id] })
      setUserId('')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo sumar al equipo'),
  })

  return (
    <Dialog open={!!team} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sumar gente a {team?.name}</DialogTitle>
          <DialogDescription>
            Elegí de entre los miembros de la cuenta.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-member">Persona</Label>
            <Select
              id="team-member"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Elegí a alguien…</option>
              {availableMembers?.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} · {m.email}
                </option>
              ))}
            </Select>
            {members && members.length > 0 && availableMembers?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Todos los miembros de la cuenta ya están en este equipo.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={add.isPending || !userId}>
              {add.isPending && <Loader2 className="animate-spin" />}
              Sumar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

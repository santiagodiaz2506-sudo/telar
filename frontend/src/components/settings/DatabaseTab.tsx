import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Loader2, PlugZap, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import {
  deleteDatabaseConnection,
  getDatabaseConnection,
  provisionDatabase,
  saveDatabaseConnection,
  testDatabaseConnection,
} from '@/lib/endpoints'
import type { DatabaseConnectionStatus, DatabaseEngine } from '@/types/api'

const ENGINE_LABEL: Record<DatabaseEngine, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
}

const DEFAULT_PORT: Record<DatabaseEngine, number> = {
  postgres: 5432,
  mysql: 3306,
}

const STATUS_LABEL: Record<DatabaseConnectionStatus, string> = {
  disconnected: 'Sin probar',
  connected: 'Conexión probada',
  provisioned: 'Aprovisionada',
  error: 'Error',
}

export function DatabaseTab({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient()
  const { data: connection, isLoading } = useQuery({
    queryKey: queryKeys.databaseConnection(accountId),
    queryFn: () => getDatabaseConnection(accountId),
  })

  const [engine, setEngine] = React.useState<DatabaseEngine>('postgres')
  const [host, setHost] = React.useState('')
  const [port, setPort] = React.useState(DEFAULT_PORT.postgres)
  const [databaseName, setDatabaseName] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [useSsl, setUseSsl] = React.useState(true)
  const [testResult, setTestResult] = React.useState<{ ok: boolean; error: string | null } | null>(
    null,
  )

  React.useEffect(() => {
    if (!connection) return
    setEngine(connection.engine)
    setHost(connection.host)
    setPort(connection.port)
    setDatabaseName(connection.database_name)
    setUsername(connection.username)
    setUseSsl(connection.use_ssl)
    setPassword('')
  }, [connection])

  function currentForm() {
    return {
      engine,
      host: host.trim(),
      port,
      database_name: databaseName.trim(),
      username: username.trim(),
      password,
      use_ssl: useSsl,
    }
  }

  const test = useMutation({
    mutationFn: () => testDatabaseConnection(accountId, currentForm()),
    onSuccess: (result) => {
      setTestResult(result)
      if (result.ok) toast.success('Se pudo conectar')
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'No se pudo probar la conexión'
      setTestResult({ ok: false, error: message })
    },
  })

  const saveAndProvision = useMutation({
    mutationFn: async () => {
      await saveDatabaseConnection(accountId, currentForm())
      return provisionDatabase(accountId)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['database-connection', accountId], result)
      setPassword('')
      setTestResult(null)
      if (result.status === 'provisioned') {
        toast.success('Base conectada y aprovisionada', {
          description: 'Se crearon (o ya existían) telar_roles, telar_users, telar_contacts y telar_conversations.',
        })
      } else {
        toast.error('Se guardó, pero el aprovisionamiento falló', {
          description: result.last_error ?? undefined,
        })
      }
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar la conexión'),
  })

  const remove = useMutation({
    mutationFn: () => deleteDatabaseConnection(accountId),
    onSuccess: () => {
      toast.success('Conexión eliminada')
      queryClient.setQueryData(['database-connection', accountId], null)
      setHost('')
      setDatabaseName('')
      setUsername('')
      setPassword('')
      setTestResult(null)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar'),
  })

  if (isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold">Base de datos de la cuenta</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Postgres o MySQL propio del cliente. Al aprovisionar se crean ahí 3 tablas relacionadas
          por foreign key: <span className="font-mono text-[12px]">telar_roles</span> →{' '}
          <span className="font-mono text-[12px]">telar_users</span> →{' '}
          <span className="font-mono text-[12px]">telar_conversations</span> ←{' '}
          <span className="font-mono text-[12px]">telar_contacts</span>.
        </p>
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
          Esto es la base que el cliente trae para operar sus propios datos -- todavía no
          reemplaza la Postgres compartida donde vive el resto de Telar (login, memoria del
          agente, bases de conocimiento). Enrutar contactos y conversaciones para que usen esta
          conexión en vez de la compartida es un paso aparte, más adelante.
        </p>
      </div>

      {connection && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
          <Database className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate text-[13px]">
            {ENGINE_LABEL[connection.engine]} · {connection.host}:{connection.port}/
            {connection.database_name}
          </span>
          <StatusBadge status={connection.status} />
        </div>
      )}
      {connection?.status === 'error' && connection.last_error && (
        <p className="rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive">
          {connection.last_error}
        </p>
      )}

      <form
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault()
          setTestResult(null)
          saveAndProvision.mutate()
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-engine">Motor</Label>
            <Select
              id="db-engine"
              value={engine}
              onChange={(e) => {
                const next = e.target.value as DatabaseEngine
                setEngine(next)
                setPort((current) =>
                  current === DEFAULT_PORT[engine] ? DEFAULT_PORT[next] : current,
                )
              }}
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-port">Puerto</Label>
            <Input
              id="db-port"
              type="number"
              required
              value={port}
              onChange={(e) => setPort(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="db-host">Host</Label>
          <Input
            id="db-host"
            required
            placeholder="db.mi-empresa.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="db-name">Base de datos</Label>
          <Input
            id="db-name"
            required
            className="font-mono"
            value={databaseName}
            onChange={(e) => setDatabaseName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-username">Usuario</Label>
            <Input
              id="db-username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-password">Contraseña</Label>
            <Input
              id="db-password"
              type="password"
              required={!connection}
              placeholder={connection ? 'Dejar vacío para no cambiarla' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--primary)]"
            checked={useSsl}
            onChange={(e) => setUseSsl(e.target.checked)}
          />
          Usar SSL
        </label>

        {testResult && (
          <p
            className={
              testResult.ok
                ? 'rounded-md bg-status-open-soft px-3 py-2.5 text-[13px] text-status-open'
                : 'rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive'
            }
          >
            {testResult.ok ? 'Se pudo conectar correctamente.' : testResult.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={test.isPending || !host.trim() || !databaseName.trim() || !username.trim() || !password.trim()}
            onClick={() => {
              setTestResult(null)
              test.mutate()
            }}
          >
            {test.isPending ? <Loader2 className="animate-spin" /> : <PlugZap />}
            Probar conexión
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={
              saveAndProvision.isPending ||
              !host.trim() ||
              !databaseName.trim() ||
              !username.trim() ||
              (!connection && !password.trim())
            }
          >
            {saveAndProvision.isPending && <Loader2 className="animate-spin" />}
            Guardar y aprovisionar
          </Button>
          {connection && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2 />
              Eliminar conexión
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}

function StatusBadge({ status }: { status: DatabaseConnectionStatus }) {
  const variant: 'default' | 'destructive' | 'secondary' =
    status === 'provisioned' ? 'default' : status === 'error' ? 'destructive' : 'secondary'
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>
}

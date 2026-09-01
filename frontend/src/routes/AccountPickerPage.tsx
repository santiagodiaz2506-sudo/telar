import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronRight, Plus } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LogoMark } from '@/components/Logo'
import { NewAccountDialog } from '@/components/NewAccountDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth'
import { getAccounts } from '@/lib/endpoints'
import { BootScreen } from '@/routes/AccountLayout'

export function AccountPickerPage() {
  const { user, loading } = useAuth()
  const [creating, setCreating] = React.useState(false)
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: !!user,
  })

  if (loading) return <BootScreen />
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="relative min-h-svh bg-background">
      <div className="absolute top-5 right-5">
        <ThemeToggle collapsed />
      </div>

      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-6 py-12">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <LogoMark className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Telar</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">Elegí una cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hola {user.name.split(' ')[0]}. Estas son las cuentas a las que tenés acceso.
          </p>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        )}

        {accounts?.length === 0 && (
          <EmptyState
            icon={Building2}
            title="Todavía no pertenecés a ninguna cuenta"
            description={
              user.is_superadmin
                ? 'Creá la primera cuenta para empezar a operar.'
                : 'Pedile a un administrador de la cuenta que te sume.'
            }
            action={
              user.is_superadmin ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus />
                  Crear cuenta
                </Button>
              ) : undefined
            }
          />
        )}

        <div className="flex flex-col gap-2">
          {accounts?.map((account) => (
            <Link
              key={account.id}
              to={`/accounts/${account.id}/conversations`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground group-hover:bg-primary-soft group-hover:text-primary-soft-foreground">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{account.name}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        {user.is_superadmin && !!accounts?.length && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setCreating(true)}>
            <Plus />
            Crear cuenta
          </Button>
        )}

        <NewAccountDialog open={creating} onOpenChange={setCreating} />
      </div>
    </div>
  )
}

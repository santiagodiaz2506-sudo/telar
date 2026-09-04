import { Navigate, Outlet, useParams } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuth } from '@/lib/auth'

export function AccountLayout() {
  const { accountId } = useParams<{ accountId: string }>()
  const { user, loading, roleForAccount } = useAuth()

  if (loading) return <BootScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!accountId) return <Navigate to="/" replace />

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <Sidebar accountId={accountId} role={roleForAccount(accountId)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

/** Pantalla de arranque mientras se restaura la sesión: nunca un blanco vacío. */
export function BootScreen() {
  return (
    <div className="flex h-svh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-pulse">
          <Logo variant="mark" size={40} />
        </div>
        <span className="text-sm text-muted-foreground">Cargando Telar…</span>
      </div>
    </div>
  )
}

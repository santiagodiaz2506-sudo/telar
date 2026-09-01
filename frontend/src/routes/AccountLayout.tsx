import { LogOut } from 'lucide-react'
import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

export function AccountLayout() {
  const { accountId } = useParams<{ accountId: string }>()
  const { user, loading, logout, roleForAccount } = useAuth()
  const navigate = useNavigate()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!accountId) return <Navigate to="/" replace />

  const role = roleForAccount(accountId)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
    }`

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Telar</span>
          <nav className="flex gap-1">
            <NavLink to={`/accounts/${accountId}/conversations`} className={navLinkClass}>
              Conversaciones
            </NavLink>
            <NavLink to={`/accounts/${accountId}/contacts`} className={navLinkClass}>
              Contactos
            </NavLink>
            {(role === 'administrator' || role === 'superadmin') && (
              <NavLink to={`/accounts/${accountId}/bot`} className={navLinkClass}>
                Flujo del bot
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {user.name} {role && <span className="text-xs">({role})</span>}
          </span>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Salir">
            <LogOut />
          </Button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

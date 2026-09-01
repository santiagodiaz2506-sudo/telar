import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'

import { getAccounts } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'

/** Decide a dónde va un usuario autenticado según a cuántas cuentas pertenece. */
export function RootRedirect() {
  const { user, loading: authLoading } = useAuth()
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: !!user,
  })

  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (isLoading) return null

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 text-center text-muted-foreground">
        No tenés cuentas asignadas todavía. Pedile a un administrador que te sume.
      </div>
    )
  }

  if (accounts.length === 1) {
    return <Navigate to={`/accounts/${accounts[0].id}/conversations`} replace />
  }

  return <Navigate to="/accounts" replace />
}

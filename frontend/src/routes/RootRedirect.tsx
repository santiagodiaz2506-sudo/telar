import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'

import { getAccounts } from '@/lib/endpoints'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/lib/auth'
import { BootScreen } from '@/routes/AccountLayout'

/** Decide a dónde va un usuario autenticado según a cuántas cuentas pertenece. */
export function RootRedirect() {
  const { user, loading: authLoading } = useAuth()
  const { data: accounts, isLoading } = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: getAccounts,
    enabled: !!user,
  })

  if (authLoading) return <BootScreen />
  if (!user) return <Navigate to="/login" replace />
  if (isLoading) return <BootScreen />

  if (!accounts || accounts.length === 0) return <Navigate to="/accounts" replace />
  if (accounts.length === 1) {
    return <Navigate to={`/accounts/${accounts[0].id}/conversations`} replace />
  }
  return <Navigate to="/accounts" replace />
}

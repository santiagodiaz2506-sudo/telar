import * as React from 'react'

import { ApiError, clearToken, getToken, setToken } from '@/lib/api'
import { getMe, login as apiLogin } from '@/lib/endpoints'
import type { MeResponse } from '@/types/api'

interface AuthContextValue {
  user: MeResponse | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  roleForAccount: (accountId: string) => string | null
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<MeResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  const restore = React.useCallback(async () => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    try {
      const me = await getMe()
      setUser(me)
    } catch (e) {
      if (e instanceof ApiError) {
        clearToken()
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    restore()
  }, [restore])

  const login = React.useCallback(async (email: string, password: string) => {
    const { access_token } = await apiLogin(email, password)
    setToken(access_token)
    const me = await getMe()
    setUser(me)
  }, [])

  const logout = React.useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const roleForAccount = React.useCallback(
    (accountId: string) => {
      if (!user) return null
      if (user.is_superadmin) return 'superadmin'
      return user.accounts.find((a) => a.account_id === accountId)?.role ?? null
    },
    [user],
  )

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, roleForAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

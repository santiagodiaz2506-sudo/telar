const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'telar_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Todas las llamadas a la API pasan por acá: agrega el header de auth,
 * castea JSON, y en 401 limpia la sesión (el que llama a apiFetch en un
 * contexto sin sesión propia -- ver auth.tsx -- decide qué hacer con eso).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const resp = await fetch(`${API_URL}${path}`, { ...init, headers })

  if (resp.status === 401) {
    clearToken()
    throw new ApiError(401, 'No autenticado')
  }

  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      detail = body.detail ?? detail
    } catch {
      // el body no era JSON, nos quedamos con statusText
    }
    throw new ApiError(resp.status, detail)
  }

  if (resp.status === 204) {
    return undefined as T
  }

  return (await resp.json()) as T
}

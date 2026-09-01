import type { AccountRoleValue } from '@/types/api'

export const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Superadmin',
  administrator: 'Administrador',
  supervisor: 'Supervisor',
  agent: 'Asesor',
}

export const ROLE_HINT: Record<AccountRoleValue, string> = {
  administrator: 'Gestiona miembros, equipos y el flujo del bot.',
  supervisor: 'Mueve gente entre equipos y reasigna conversaciones.',
  agent: 'Atiende conversaciones y ve contactos.',
}

export const ASSIGNABLE_ROLES: AccountRoleValue[] = ['administrator', 'supervisor', 'agent']

/** Roles que pueden reasignar conversaciones y responder las de otro. */
export const ELEVATED_ROLES = ['administrator', 'supervisor', 'superadmin']

export function isElevated(role: string | null): boolean {
  return !!role && ELEVATED_ROLES.includes(role)
}

export function isAdmin(role: string | null): boolean {
  return role === 'administrator' || role === 'superadmin'
}

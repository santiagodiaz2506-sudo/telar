import { apiFetch } from '@/lib/api'
import type {
  AccountResponse,
  AvailableToolResponse,
  BotGraph,
  BotResponse,
  ConversationDetailResponse,
  ConversationResponse,
  ConversationStatusResponse,
  ConversationStatusValue,
  ContactResponse,
  MeResponse,
  MemberResponse,
  MessageResponse,
  StatsResponse,
  TeamMemberResponse,
  TeamResponse,
  TokenResponse,
} from '@/types/api'

/** El backend pagina con limit/offset y su default es 50. */
export const PAGE_SIZE = 50

export function login(email: string, password: string) {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function getMe() {
  return apiFetch<MeResponse>('/auth/me')
}

// --------------------------------------------------------------------------
// Cuentas, miembros y equipos
// --------------------------------------------------------------------------

export function getAccounts() {
  return apiFetch<AccountResponse[]>('/accounts')
}

export function createAccount(name: string) {
  return apiFetch<AccountResponse>('/accounts', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function getMembers(accountId: string) {
  return apiFetch<MemberResponse[]>(`/accounts/${accountId}/members`)
}

export function addMember(accountId: string, email: string, role: string) {
  return apiFetch<MemberResponse>(`/accounts/${accountId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

export function removeMember(accountId: string, userId: string) {
  return apiFetch<void>(`/accounts/${accountId}/members/${userId}`, { method: 'DELETE' })
}

export function getTeams(accountId: string) {
  return apiFetch<TeamResponse[]>(`/accounts/${accountId}/teams`)
}

export function createTeam(accountId: string, name: string) {
  return apiFetch<TeamResponse>(`/accounts/${accountId}/teams`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function getTeamMembers(accountId: string, teamId: string) {
  return apiFetch<TeamMemberResponse[]>(`/accounts/${accountId}/teams/${teamId}/members`)
}

export function addTeamMember(accountId: string, teamId: string, userId: string) {
  return apiFetch<void>(`/accounts/${accountId}/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
}

export function removeTeamMember(accountId: string, teamId: string, userId: string) {
  return apiFetch<void>(`/accounts/${accountId}/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  })
}

// --------------------------------------------------------------------------
// Conversaciones
// --------------------------------------------------------------------------

export function getConversations(
  accountId: string,
  status?: ConversationStatusValue,
  { limit = PAGE_SIZE, offset = 0, q }: { limit?: number; offset?: number; q?: string } = {},
) {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status) qs.set('status_filter', status)
  if (q) qs.set('q', q)
  return apiFetch<ConversationResponse[]>(`/accounts/${accountId}/conversations?${qs}`)
}

export function getConversationDetail(
  accountId: string,
  conversationId: string,
  { limit = PAGE_SIZE, before }: { limit?: number; before?: string } = {},
) {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (before) qs.set('before', before)
  return apiFetch<ConversationDetailResponse>(
    `/accounts/${accountId}/conversations/${conversationId}?${qs}`,
  )
}

export function assignConversation(
  accountId: string,
  conversationId: string,
  assigneeId?: string,
) {
  return apiFetch<ConversationStatusResponse>(
    `/accounts/${accountId}/conversations/${conversationId}/assign`,
    { method: 'POST', body: JSON.stringify({ assignee_id: assigneeId ?? null }) },
  )
}

export function resolveConversation(accountId: string, conversationId: string) {
  return apiFetch<ConversationStatusResponse>(
    `/accounts/${accountId}/conversations/${conversationId}/resolve`,
    { method: 'POST' },
  )
}

export function releaseConversation(accountId: string, conversationId: string) {
  return apiFetch<ConversationStatusResponse>(
    `/accounts/${accountId}/conversations/${conversationId}/release`,
    { method: 'POST' },
  )
}

export function sendMessage(accountId: string, conversationId: string, text: string) {
  return apiFetch<MessageResponse>(
    `/accounts/${accountId}/conversations/${conversationId}/messages`,
    { method: 'POST', body: JSON.stringify({ text }) },
  )
}

export function getContacts(
  accountId: string,
  { limit = PAGE_SIZE, offset = 0, q }: { limit?: number; offset?: number; q?: string } = {},
) {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (q) qs.set('q', q)
  return apiFetch<ContactResponse[]>(`/accounts/${accountId}/contacts?${qs}`)
}

export function getStats(accountId: string) {
  return apiFetch<StatsResponse>(`/accounts/${accountId}/stats`)
}

// --------------------------------------------------------------------------
// Bot
// --------------------------------------------------------------------------

export function getBot(accountId: string) {
  return apiFetch<BotResponse | null>(`/accounts/${accountId}/bot`)
}

export function saveBot(accountId: string, name: string, graph: BotGraph) {
  return apiFetch<BotResponse>(`/accounts/${accountId}/bot`, {
    method: 'PUT',
    body: JSON.stringify({ name, graph }),
  })
}

export function getAvailableTools(accountId: string) {
  return apiFetch<AvailableToolResponse[]>(`/accounts/${accountId}/bot/available-tools`)
}

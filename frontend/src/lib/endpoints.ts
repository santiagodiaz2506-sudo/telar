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
  MessageResponse,
  StatsResponse,
  TokenResponse,
} from '@/types/api'

export function login(email: string, password: string) {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function getMe() {
  return apiFetch<MeResponse>('/auth/me')
}

export function getAccounts() {
  return apiFetch<AccountResponse[]>('/accounts')
}

export function getConversations(accountId: string, status?: ConversationStatusValue) {
  const qs = status ? `?status_filter=${status}` : ''
  return apiFetch<ConversationResponse[]>(`/accounts/${accountId}/conversations${qs}`)
}

export function getConversationDetail(accountId: string, conversationId: string) {
  return apiFetch<ConversationDetailResponse>(
    `/accounts/${accountId}/conversations/${conversationId}`,
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

export function getContacts(accountId: string) {
  return apiFetch<ContactResponse[]>(`/accounts/${accountId}/contacts`)
}

export function getStats(accountId: string) {
  return apiFetch<StatsResponse>(`/accounts/${accountId}/stats`)
}

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

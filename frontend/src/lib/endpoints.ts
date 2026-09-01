import { apiFetch } from '@/lib/api'
import type {
  AccountResponse,
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

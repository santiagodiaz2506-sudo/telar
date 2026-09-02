// Calco directo de los modelos Pydantic de telar/telar/telar/{auth,accounts,conversations}/router.py

export interface AccountMembership {
  account_id: string
  role: string
}

export interface MeResponse {
  id: string
  email: string
  name: string
  is_superadmin: boolean
  accounts: AccountMembership[]
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface AccountResponse {
  id: string
  name: string
}

export type AccountRoleValue = 'administrator' | 'supervisor' | 'agent'

export interface MemberResponse {
  user_id: string
  email: string
  name: string
  role: string
}

export interface TeamResponse {
  id: string
  name: string
}

export interface TeamMemberResponse {
  user_id: string
  email: string
  name: string
}

export type ConversationStatusValue = 'bot' | 'pending' | 'open' | 'resolved'

export interface ConversationResponse {
  id: string
  status: ConversationStatusValue
  assignee_id: string | null
  contact_id: string
  contact_name: string | null
  contact_phone: string | null
  last_contact_message_at: string | null
}

export interface ConversationStatusResponse {
  id: string
  status: ConversationStatusValue
  assignee_id: string | null
}

export interface MessageResponse {
  id: string
  sender_type: 'contact' | 'bot' | 'agent' | 'system'
  sender_id: string | null
  type: string
  content: string | null
  /** 'pending' | 'sent' | 'delivered' | 'read' | 'failed' -- suelto porque el
   *  backend todavía puede sumar valores (webhooks de estado de Meta). */
  delivery_status: string
  created_at: string
}

export interface ConversationDetailResponse {
  id: string
  status: ConversationStatusValue
  assignee_id: string | null
  contact_id: string
  contact_name: string | null
  contact_phone: string | null
  last_contact_message_at: string | null
  messages: MessageResponse[]
}

export interface ContactResponse {
  id: string
  external_id: string
  name: string | null
  phone: string | null
  email: string | null
}

export interface GraphNode {
  id: string
  type: 'agent'
  system_prompt?: string | null
  tools?: string[] | null
}

export interface GraphEdge {
  from: string
  to: string
}

export interface BotGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface BotResponse {
  id: string
  name: string
  version: number
  graph: BotGraph
}

export interface AvailableToolResponse {
  name: string
  description: string
}

export interface TemplateComponent {
  type: string
  format?: string
  text?: string
  buttons?: unknown[]
}

export interface TemplateResponse {
  id: string
  name: string
  language: string
  components: TemplateComponent[]
}

export interface BotVersionResponse {
  id: string
  version: number
  notes: string | null
  created_by: string | null
  created_at: string
  is_active: boolean
}

export interface InboxResponse {
  id: string
  name: string
  channel: string
  phone_number_id: string | null
  waba_id: string | null
  default_team_id: string | null
  created_at: string
}

export type ToolKind = 'http' | 'sql'

export interface ToolResponse {
  id: string
  name: string
  description: string
  kind: ToolKind
  config: Record<string, unknown>
  schema: Record<string, unknown>
}

export interface ToolAdminResponse extends ToolResponse {
  enabled: boolean
}

export interface KnowledgeBaseResponse {
  id: string
  name: string
  embedding_model: string
  dimensions: number
}

export interface IngestResponse {
  chunks_inserted: number
}

export interface StatsResponse {
  bot: number
  pending: number
  open: number
  resolved: number
}

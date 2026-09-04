/**
 * Query keys de TanStack Query, centralizadas por dominio.
 *
 * Antes cada componente escribía la key a mano -- ['members', accountId]
 * aparecía igual, sin importarse entre archivos, en al menos cinco lugares
 * distintos. Funciona mientras todas las copias sean idénticas, pero un
 * error de tipeo en una sola rompe la invalidación de caché justo ahí, sin
 * ningún error visible en desarrollo. Este módulo es la única fuente de
 * verdad: un cambio de forma de una key se hace acá y se propaga solo.
 *
 * `conversations.byAccount` existe además de `.all` y `.list` a propósito:
 * TanStack invalida por prefijo, así que invalidar `byAccount(accountId)`
 * alcanza tanto a `.all(accountId)` como a cualquier `.list(accountId, …)`
 * sin tener que enumerar cada variante en cada lugar que dispara un cambio.
 */
export const queryKeys = {
  accounts: () => ['accounts'] as const,
  stats: (accountId: string) => ['stats', accountId] as const,

  members: (accountId: string) => ['members', accountId] as const,
  teams: (accountId: string) => ['teams', accountId] as const,
  teamMembers: (accountId: string, teamId: string | undefined) =>
    ['team-members', accountId, teamId] as const,

  inboxes: (accountId: string) => ['inboxes', accountId] as const,

  tools: (accountId: string) => ['tools', accountId] as const,
  availableTools: (accountId: string) => ['available-tools', accountId] as const,

  templates: (accountId: string) => ['templates', accountId] as const,
  knowledgeBases: (accountId: string) => ['knowledge-bases', accountId] as const,
  llmProviders: (accountId: string) => ['llm-providers', accountId] as const,
  databaseConnection: (accountId: string) => ['database-connection', accountId] as const,

  bot: (accountId: string) => ['bot', accountId] as const,
  botVersions: (accountId: string) => ['bot-versions', accountId] as const,

  conversation: (accountId: string, conversationId: string) =>
    ['conversation', accountId, conversationId] as const,
  conversations: {
    byAccount: (accountId: string) => ['conversations', accountId] as const,
    all: (accountId: string) => ['conversations', accountId, 'all'] as const,
    list: (accountId: string, filter: string, teamId: string, query: string) =>
      ['conversations', accountId, 'list', filter, teamId, query] as const,
  },

  contacts: (accountId: string, query: string) => ['contacts', accountId, query] as const,
}

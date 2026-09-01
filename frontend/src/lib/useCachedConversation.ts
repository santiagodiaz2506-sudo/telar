import { useQueryClient } from '@tanstack/react-query'

import type { ConversationResponse } from '@/types/api'

/**
 * ConversationDetailResponse no trae nombre ni teléfono del contacto — solo
 * contact_id. La lista sí los trae, así que los recuperamos de la caché de
 * cualquiera de los filtros ya cargados en vez de pedir la lista completa de
 * contactos (que también está paginada y podría no incluirlo).
 *
 * Cuando el backend agregue el contacto al detalle, esto se borra.
 */
export function useCachedConversation(
  accountId: string | undefined,
  conversationId: string | undefined,
): ConversationResponse | undefined {
  const queryClient = useQueryClient()
  if (!accountId || !conversationId) return undefined

  const entries = queryClient.getQueriesData<{ pages: ConversationResponse[][] }>({
    queryKey: ['conversations', accountId],
  })

  for (const [, data] of entries) {
    const found = data?.pages?.flat().find((c) => c.id === conversationId)
    if (found) return found
  }
  return undefined
}

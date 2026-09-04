import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { getConversations } from '@/lib/endpoints'

const BASE_TITLE = document.title

/**
 * Cambia el título de la pestaña cuando llega un mensaje nuevo mientras
 * Telar no está a la vista (otra pestaña, otra ventana, minimizado) --
 * hoy un agente no se entera de nada hasta que vuelve a la bandeja.
 *
 * El polling normal de la lista (InboxLayout) se pausa en segundo plano
 * por default de TanStack Query, y además solo mira el filtro/búsqueda
 * activos. Acá se arma una consulta aparte, liviana (una sola fila, sin
 * filtro), que sigue corriendo en background para detectar la novedad
 * sin importar en qué filtro haya quedado la bandeja ni en qué pantalla
 * esté el agente dentro de la cuenta.
 */
export function useNewMessageTitleAlert(accountId: string | undefined) {
  const [unseen, setUnseen] = React.useState(0)
  const lastSeenRef = React.useRef<string | null>(null)
  const activeRef = React.useRef(true)

  const { data } = useQuery({
    queryKey: ['conversations', 'latest-activity', accountId],
    queryFn: () => getConversations(accountId!, undefined, { limit: 1 }),
    enabled: !!accountId,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

  const latest = data?.[0]?.last_contact_message_at ?? null

  // Detecta la novedad: compara contra la última marca vista, no contra
  // "cuántas hay" -- así no importa si la conversación más reciente
  // cambia de lugar por otro motivo (reasignación, etc.).
  React.useEffect(() => {
    if (!latest) return
    if (lastSeenRef.current === null) {
      lastSeenRef.current = latest // primera carga: fija la base, no alerta
      return
    }
    if (latest === lastSeenRef.current) return
    lastSeenRef.current = latest
    if (!activeRef.current) setUnseen((n) => n + 1)
  }, [latest])

  // "Visible" no alcanza: una ventana de fondo en un segundo monitor
  // puede estar visible sin tener foco. Se pide lo segundo también.
  React.useEffect(() => {
    function update() {
      const nowActive = document.visibilityState === 'visible' && document.hasFocus()
      activeRef.current = nowActive
      if (nowActive) setUnseen(0)
    }
    update()
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
    }
  }, [])

  React.useEffect(() => {
    document.title = unseen > 0 ? `(${unseen}) ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = BASE_TITLE
    }
  }, [unseen])
}

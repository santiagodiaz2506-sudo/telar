/**
 * Estado de red global, alimentado directamente desde `apiFetch` (lib/api.ts)
 * -- es el único lugar por donde pasan todas las llamadas a la API, así que
 * es el punto correcto para detectar "no hay conexión con el servidor" sin
 * depender de que cada componente maneje su propio error de red.
 *
 * A propósito NO usa React Query ni contexto: es un store mínimo con
 * useSyncExternalStore, para que un fallo de red temprano (antes de que
 * cualquier provider esté montado) no se pierda.
 */

type Listener = () => void

// Dos fallas seguidas, no una sola -- una request perdida aislada no
// significa "sin conexión", pasa todo el tiempo con redes inestables.
const OFFLINE_THRESHOLD = 2

let consecutiveFailures = 0
let offline = false
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

/** Llamar cuando `fetch()` devolvió una respuesta, sea cual sea su status
 * -- un 404/500 real del backend significa que la red anda perfecto. */
export function reportApiSuccess() {
  consecutiveFailures = 0
  if (offline) {
    offline = false
    emit()
  }
}

/** Llamar solo cuando `fetch()` en sí tiró (sin respuesta del server):
 * DNS, conexión rechazada, timeout de red, CORS. */
export function reportApiNetworkFailure() {
  consecutiveFailures += 1
  const shouldBeOffline = consecutiveFailures >= OFFLINE_THRESHOLD
  if (shouldBeOffline !== offline) {
    offline = shouldBeOffline
    emit()
  }
}

export function subscribeNetworkStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getNetworkStatusSnapshot(): boolean {
  return offline
}

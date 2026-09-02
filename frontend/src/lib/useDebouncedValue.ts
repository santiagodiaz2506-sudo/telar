import * as React from 'react'

/**
 * Devuelve `value` con un retraso: evita pegarle a la API en cada tecla
 * mientras alguien todavía está escribiendo una búsqueda.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

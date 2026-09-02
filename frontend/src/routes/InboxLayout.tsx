import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronDown, Inbox, Loader2, RefreshCw, Search, X } from 'lucide-react'
import * as React from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { ConversationListItem } from '@/components/inbox/ConversationListItem'
import { StatusDot } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth'
import { getConversations, getStats, PAGE_SIZE } from '@/lib/endpoints'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { cn } from '@/lib/utils'
import type { ConversationStatusValue } from '@/types/api'

type Filter = ConversationStatusValue | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Espera' },
  { value: 'open', label: 'Asesor' },
  { value: 'bot', label: 'Bot' },
  { value: 'resolved', label: 'Resueltas' },
]

export function InboxLayout() {
  const { accountId, conversationId } = useParams<{
    accountId: string
    conversationId?: string
  }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = React.useState<Filter>('all')
  const [query, setQuery] = React.useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  const searchRef = React.useRef<HTMLInputElement>(null)

  /**
   * La API pagina con limit/offset y su default son 50. Sin esto la bandeja
   * se cortaba en la primera página sin ningún aviso.
   */
  const {
    data,
    isLoading,
    isFetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['conversations', accountId, 'list', filter, debouncedQuery],
    queryFn: ({ pageParam }) =>
      getConversations(accountId!, filter === 'all' ? undefined : filter, {
        offset: pageParam,
        q: debouncedQuery || undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    enabled: !!accountId,
    // Un refresco de fondo vuelve a pedir TODAS las páginas cargadas. Mientras
    // se está en la primera vale la pena; después se corta y queda el botón.
    refetchInterval: (query) => ((query.state.data?.pages.length ?? 1) > 1 ? false : 8000),
  })

  const conversations = React.useMemo(() => data?.pages.flat(), [data])

  const { data: stats } = useQuery({
    queryKey: ['stats', accountId],
    queryFn: () => getStats(accountId!),
    enabled: !!accountId,
    refetchInterval: 8000,
  })

  const counts: Record<Filter, number | undefined> = {
    all: stats && stats.bot + stats.pending + stats.open + stats.resolved,
    bot: stats?.bot,
    pending: stats?.pending,
    open: stats?.open,
    resolved: stats?.resolved,
  }

  /* El filtrado ahora lo hace el backend (?q=, busca en TODAS las
     conversaciones, no solo en las páginas ya cargadas). */
  const visible = conversations ?? []

  /* Atajos: "/" busca, j/k recorren la lista sin sacar las manos del teclado. */
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key !== 'j' && e.key !== 'k') return
      if (visible.length === 0) return

      e.preventDefault()
      const index = visible.findIndex((c) => c.id === conversationId)
      const next =
        e.key === 'j'
          ? Math.min(index + 1, visible.length - 1)
          : Math.max(index - 1, 0)
      const target2 = visible[index === -1 ? 0 : next]
      if (target2) navigate(`/accounts/${accountId}/conversations/${target2.id}`)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [visible, conversationId, accountId, navigate])

  if (!accountId) return null

  return (
    <div className="flex min-h-0 flex-1">
      <section
        className="flex w-[336px] shrink-0 flex-col border-r border-border bg-surface"
        aria-label="Lista de conversaciones"
      >
        {/* Encabezado */}
        <div className="flex h-14 items-center gap-2 px-4">
          <h1 className="text-[15px] font-semibold tracking-tight">Conversaciones</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                onClick={() => refetch()}
                aria-label="Actualizar lista"
              >
                <RefreshCw className={cn(isFetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Actualizar</TooltipContent>
          </Tooltip>
        </div>

        {/* Búsqueda */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="Buscar por nombre o teléfono"
              aria-label="Buscar conversaciones"
              className="h-8 w-full rounded-md border border-border bg-background pr-8 pl-8 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1 text-[10px] text-muted-foreground">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filtros por estado, con el conteo de cada uno */}
        <div className="flex flex-wrap gap-1 px-3 pb-2.5">
          {FILTERS.map((f) => {
            const active = filter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                aria-pressed={active}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11.5px] font-medium transition-colors duration-150',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                )}
              >
                {f.value !== 'all' && !active && <StatusDot status={f.value} />}
                {f.label}
                {counts[f.value] !== undefined && (
                  <span className={cn('tabular', !active && 'text-muted-foreground/70')}>
                    {counts[f.value]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Lista */}
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {isLoading && <ListSkeleton />}

          {!isLoading && visible.length === 0 && (
            <EmptyState
              icon={Inbox}
              title={query ? 'Nada coincide con la búsqueda' : 'No hay conversaciones acá'}
              description={
                query
                  ? 'Probá con otro nombre o con el número completo.'
                  : filter === 'all'
                    ? 'Cuando alguien le escriba a tu número de WhatsApp, la conversación aparece en esta lista.'
                    : 'Cambiá de filtro para ver las demás.'
              }
              className="py-10"
              action={
                query ? (
                  <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                    Limpiar búsqueda
                  </Button>
                ) : filter !== 'all' ? (
                  <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                    Ver todas
                  </Button>
                ) : undefined
              }
            />
          )}

          {visible.map((c) => (
            <ConversationListItem
              key={c.id}
              conversation={c}
              accountId={accountId}
              assignedToMe={!!user && c.assignee_id === user.id}
            />
          ))}

          {visible.length > 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-3">
              {hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  {isFetchingNextPage ? <Loader2 className="animate-spin" /> : <ChevronDown />}
                  {isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
                </Button>
              )}
              <p className="text-center text-[11px] text-muted-foreground">
                {visible.length} {visible.length === 1 ? 'conversación' : 'conversaciones'}
                {hasNextPage && ' cargadas'} ·{' '}
                <kbd className="rounded border border-border px-1">j</kbd>{' '}
                <kbd className="rounded border border-border px-1">k</kbd> para moverte
              </p>
              {(data?.pages.length ?? 1) > 1 && (
                <p className="text-center text-[11px] text-muted-foreground/70">
                  El refresco automático se pausa mientras haya más de una página cargada.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <Outlet />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3.5">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

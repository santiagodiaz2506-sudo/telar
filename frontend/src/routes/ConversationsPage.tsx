import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { StatsBar } from '@/components/StatsBar'
import { StatusBadge } from '@/components/StatusBadge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getConversations } from '@/lib/endpoints'
import type { ConversationStatusValue } from '@/types/api'

const TABS: { value: ConversationStatusValue | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'bot', label: 'Bot' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'open', label: 'Abiertas' },
  { value: 'resolved', label: 'Resueltas' },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export function ConversationsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = React.useState<ConversationStatusValue | 'all'>('all')

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', accountId, tab],
    queryFn: () => getConversations(accountId!, tab === 'all' ? undefined : tab),
    enabled: !!accountId,
    refetchInterval: 8000,
  })

  if (!accountId) return null

  return (
    <div className="flex h-full flex-col">
      <StatsBar accountId={accountId} />
      <div className="border-b px-4 py-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ConversationStatusValue | 'all')}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Cargando...</p>}
        {conversations?.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No hay conversaciones acá.</p>
        )}
        {conversations?.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/accounts/${accountId}/conversations/${c.id}`)}
            className="flex w-full items-center justify-between border-b px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{c.contact_name ?? c.contact_phone ?? 'Sin nombre'}</span>
              <span className="text-xs text-muted-foreground">{c.contact_phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {formatDate(c.last_contact_message_at)}
              </span>
              <StatusBadge status={c.status} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

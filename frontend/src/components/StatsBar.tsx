import { useQuery } from '@tanstack/react-query'

import { getStats } from '@/lib/endpoints'

const LABELS: { key: 'bot' | 'pending' | 'open' | 'resolved'; label: string }[] = [
  { key: 'bot', label: 'En bot' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'open', label: 'Abiertas' },
  { key: 'resolved', label: 'Resueltas' },
]

export function StatsBar({ accountId }: { accountId: string }) {
  const { data: stats } = useQuery({
    queryKey: ['stats', accountId],
    queryFn: () => getStats(accountId),
    refetchInterval: 8000,
  })

  return (
    <div className="flex gap-4 border-b px-4 py-3 text-sm">
      {LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-baseline gap-1.5">
          <span className="font-semibold">{stats ? stats[key] : '–'}</span>
          <span className="text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

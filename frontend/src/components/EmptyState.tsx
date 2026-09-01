import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  /** Trama de fondo — sólo para vacíos que ocupan una pantalla entera */
  weave?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  weave = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {weave && <div className="weave-bg pointer-events-none absolute inset-0 opacity-40" />}
      <div className="relative grid size-11 place-items-center rounded-xl border border-border bg-surface-2 text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="relative max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="relative pt-1">{action}</div>}
    </div>
  )
}

import { cn } from '@/lib/utils'

/**
 * Marca de Telar: dos urdimbres y dos tramas entrelazadas alternando
 * por encima y por debajo. Legible desde 16px.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={cn('size-6', className)}
    >
      <path d="M2.5 6q4.75-5 9.5 0t9.5 0" />
      <path d="M2.5 12q4.75 5 9.5 0t9.5 0" />
      <path d="M2.5 18q4.75-5 9.5 0t9.5 0" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <LogoMark className="size-[18px]" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Telar</span>
    </div>
  )
}

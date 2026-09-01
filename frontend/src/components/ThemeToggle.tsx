import { MoonStar, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/lib/theme'

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { resolved, toggle } = useTheme()
  const label = resolved === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  const Icon = resolved === 'dark' ? Sun : MoonStar

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label}>
            <Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="justify-start gap-2.5">
      <Icon />
      {resolved === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    </Button>
  )
}

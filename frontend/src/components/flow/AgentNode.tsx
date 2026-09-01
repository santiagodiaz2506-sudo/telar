import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Bot, Wrench } from 'lucide-react'

import type { AgentNodeData } from '@/lib/flowGraph'
import { cn } from '@/lib/utils'

const handleClass =
  '!size-2.5 !border-2 !border-background !bg-border-strong transition-colors hover:!bg-primary'

export function AgentNode({ id, data, selected }: NodeProps & { data: AgentNodeData }) {
  const prompt = data.systemPrompt?.trim()
  const toolCount = data.tools === null ? null : data.tools.length
  /* El id generado lleva timestamp; en el lienzo solo interesa el prefijo. */
  const label = id.replace(/_\d{10,}_\d+$/, '')

  return (
    <div
      className={cn(
        'w-60 overflow-hidden rounded-xl border bg-surface text-left shadow-panel transition-[border-color,box-shadow] duration-150',
        selected ? 'border-primary ring-[3px] ring-primary/25' : 'border-border hover:border-border-strong',
      )}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />

      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-foreground">
          <Bot className="size-3.5" />
        </span>
        <span className="truncate font-mono text-[12px] font-medium">{label}</span>
      </div>

      <div className="px-3 py-2.5">
        <p
          className={cn(
            'line-clamp-3 text-[12px] leading-relaxed',
            prompt ? 'text-foreground' : 'text-muted-foreground italic',
          )}
        >
          {prompt || 'Sin instrucciones propias — usa el prompt de la cuenta'}
        </p>

        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Wrench className="size-3" />
          {toolCount === null
            ? 'Todas las tools'
            : toolCount === 0
              ? 'Sin tools'
              : `${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}`}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

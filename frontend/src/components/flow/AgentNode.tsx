import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Bot } from 'lucide-react'

import type { AgentNodeData } from '@/lib/flowGraph'
import { cn } from '@/lib/utils'

export function AgentNode({ id, data, selected }: NodeProps & { data: AgentNodeData }) {
  const preview = data.systemPrompt?.trim() || 'Sin instrucciones todavía'
  const toolCount = data.tools === null ? 'todas' : data.tools.length

  return (
    <div
      className={cn(
        'w-56 rounded-lg border bg-card p-3 shadow-sm transition-colors',
        selected && 'border-primary ring-2 ring-primary/30',
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Bot className="size-4 text-muted-foreground" />
        {id}
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
      <p className="mt-2 text-xs text-muted-foreground">Tools: {toolCount}</p>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

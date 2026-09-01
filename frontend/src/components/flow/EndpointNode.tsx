import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CircleDot, Flag } from 'lucide-react'

import type { EndpointNodeData } from '@/lib/flowGraph'

export function EndpointNode({ data }: NodeProps & { data: EndpointNodeData }) {
  const isStart = data.label === 'START'
  const Icon = isStart ? CircleDot : Flag

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
      {!isStart && (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2.5 !border-2 !border-background !bg-border-strong"
        />
      )}
      <Icon className="size-3" />
      {isStart ? 'INICIO' : 'FIN'}
      {isStart && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !border-2 !border-background !bg-border-strong"
        />
      )}
    </div>
  )
}

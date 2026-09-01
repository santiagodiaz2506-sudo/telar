import { Handle, Position, type NodeProps } from '@xyflow/react'

import type { EndpointNodeData } from '@/lib/flowGraph'

export function EndpointNode({ data }: NodeProps & { data: EndpointNodeData }) {
  const isStart = data.label === 'START'
  return (
    <div className="rounded-full border bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
      {!isStart && <Handle type="target" position={Position.Left} />}
      {data.label}
      {isStart && <Handle type="source" position={Position.Right} />}
    </div>
  )
}

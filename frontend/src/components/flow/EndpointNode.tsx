import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Send } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface EndpointNodeData {
  [key: string]: unknown
  label: 'END'
  phoneNumberId: string | null
}

/**
 * Nodo de salida del hilo. Clic para ver cómo y por dónde sale la
 * respuesta -- ver OutputConfigPanel.tsx para por qué la mayoría de estos
 * campos son informativos y no editables: el agente genera el texto, no
 * hay un "cuerpo fijo" que configurar acá.
 */
export function EndpointNode({ data, selected }: NodeProps & { data: EndpointNodeData }) {
  return (
    <div
      className={cn(
        'w-56 overflow-hidden rounded-xl border bg-surface text-left shadow-panel transition-[border-color,box-shadow] duration-150',
        selected ? 'border-primary ring-[3px] ring-primary/25' : 'border-border hover:border-border-strong',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-background !bg-border-strong transition-colors hover:!bg-primary"
      />

      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground">
          <Send className="size-3.5" />
        </span>
        <span className="truncate text-[12px] font-medium">Salida de WhatsApp</span>
      </div>

      <div className="px-3 py-2.5">
        <p className="truncate text-[12px] font-medium text-foreground">Responder al contacto</p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {data.phoneNumberId ?? 'Sin número conectado'}
        </p>
      </div>
    </div>
  )
}

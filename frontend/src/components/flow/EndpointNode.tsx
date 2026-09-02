import { Handle, Position } from '@xyflow/react'
import { Flag } from 'lucide-react'

/**
 * Nodo de fin del hilo. El de inicio es TriggerNode -- muestra la conexión
 * de WhatsApp, no un pill decorativo como este.
 */
export function EndpointNode() {
  return (
    <div
      title="El bot responde automáticamente por el mismo número de WhatsApp de donde vino el mensaje"
      className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-background !bg-border-strong"
      />
      <Flag className="size-3" />
      FIN
    </div>
  )
}

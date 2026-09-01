import { Trash2, Wrench, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AgentNodeData } from '@/lib/flowGraph'
import { cn } from '@/lib/utils'
import type { AvailableToolResponse } from '@/types/api'

interface Props {
  nodeId: string
  data: AgentNodeData
  availableTools: AvailableToolResponse[]
  onChange: (data: AgentNodeData) => void
  onDelete: () => void
  onClose: () => void
}

export function NodeEditPanel({
  nodeId,
  data,
  availableTools,
  onChange,
  onDelete,
  onClose,
}: Props) {
  const selectedTools = data.tools // null = todas
  const label = nodeId.replace(/_\d{10,}_\d+$/, '')

  function toggleTool(name: string) {
    if (selectedTools === null) {
      // pasaba de "todas" a una lista explícita con todas menos la que se saca
      onChange({ ...data, tools: availableTools.map((t) => t.name).filter((n) => n !== name) })
      return
    }
    const next = selectedTools.includes(name)
      ? selectedTools.filter((n) => n !== name)
      : [...selectedTools, name]
    onChange({ ...data, tools: next })
  }

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-border bg-surface">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold">{label}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar panel">
          <X />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="system-prompt">Instrucciones</Label>
          <p className="text-xs text-muted-foreground">
            Lo que este nodo le dice al modelo. Si lo dejás vacío usa el prompt por defecto de la
            cuenta.
          </p>
          <Textarea
            id="system-prompt"
            className="mt-1 min-h-40 font-mono text-[12.5px] leading-relaxed"
            placeholder="Detectá qué necesita el cliente y clasificá el caso…"
            value={data.systemPrompt ?? ''}
            onChange={(e) => onChange({ ...data, systemPrompt: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="gap-1.5">
              <Wrench className="size-3.5 text-muted-foreground" />
              Tools
            </Label>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onChange({ ...data, tools: selectedTools === null ? [] : null })}
            >
              {selectedTools === null ? 'Elegir manualmente' : 'Usar todas'}
            </Button>
          </div>

          {selectedTools === null ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Este nodo tiene disponibles todas las tools de la cuenta, incluidas las que agregues
              más adelante.
            </p>
          ) : availableTools.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              La cuenta no tiene tools configuradas todavía.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {availableTools.map((tool) => {
                const checked = selectedTools.includes(tool.name)
                return (
                  <label
                    key={tool.name}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                      checked
                        ? 'border-primary/40 bg-primary-soft/50'
                        : 'border-border hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 accent-[var(--primary)]"
                      checked={checked}
                      onChange={() => toggleTool(tool.name)}
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] font-medium">{tool.name}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {tool.description.split('\n')[0]}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button variant="destructive-ghost" size="sm" onClick={onDelete} className="w-full">
          <Trash2 />
          Eliminar nodo
        </Button>
      </div>
    </aside>
  )
}

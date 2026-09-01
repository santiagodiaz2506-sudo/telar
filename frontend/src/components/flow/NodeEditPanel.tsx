import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AgentNodeData } from '@/lib/flowGraph'
import type { AvailableToolResponse } from '@/types/api'

interface Props {
  nodeId: string
  data: AgentNodeData
  availableTools: AvailableToolResponse[]
  onChange: (data: AgentNodeData) => void
  onDelete: () => void
  onClose: () => void
}

export function NodeEditPanel({ nodeId, data, availableTools, onChange, onDelete, onClose }: Props) {
  const selectedTools = data.tools // null = todas

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
    <div className="flex h-full w-80 flex-col gap-4 border-l bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{nodeId}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="system-prompt">Instrucciones (system prompt)</Label>
        <Textarea
          id="system-prompt"
          className="min-h-32"
          placeholder="Vacío = usa el prompt por defecto de la cuenta"
          value={data.systemPrompt ?? ''}
          onChange={(e) => onChange({ ...data, systemPrompt: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Tools</Label>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => onChange({ ...data, tools: selectedTools === null ? [] : null })}
          >
            {selectedTools === null ? 'Elegir manualmente' : 'Usar todas'}
          </button>
        </div>
        {selectedTools === null ? (
          <p className="text-xs text-muted-foreground">Tiene disponibles todas las tools de la cuenta.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {availableTools.map((tool) => (
              <label key={tool.name} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedTools.includes(tool.name)}
                  onChange={() => toggleTool(tool.name)}
                />
                <span>
                  <span className="font-medium">{tool.name}</span>
                  <span className="block text-muted-foreground">
                    {tool.description.split('\n')[0]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <Button variant="destructive" size="sm" onClick={onDelete} className="mt-auto">
        Eliminar nodo
      </Button>
    </div>
  )
}

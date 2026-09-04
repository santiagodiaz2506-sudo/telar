import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { discoverModels } from '@/lib/endpoints'
import type { LlmProviderKind } from '@/types/api'

export function ModelDiscoveryField({
  provider,
  baseUrl,
  apiKey,
  model,
  onModelChange,
  accountId,
}: {
  provider: LlmProviderKind
  baseUrl: string
  apiKey: string
  model: string
  onModelChange: (model: string) => void
  accountId: string
}) {
  const [models, setModels] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)

  const discover = useMutation({
    mutationFn: () =>
      discoverModels(accountId, {
        provider,
        base_url: baseUrl.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      }),
    onSuccess: (data) => {
      setModels(data.models)
      setError(null)
      if (data.models.length && !data.models.includes(model)) onModelChange(data.models[0])
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudieron listar modelos'),
  })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="provider-model">Modelo</Label>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={discover.isPending}
          onClick={() => discover.mutate()}
        >
          <Sparkles />
          Descubrir modelos
        </Button>
      </div>
      <Combobox
        id="provider-model"
        value={model}
        onChange={onModelChange}
        options={models}
        placeholder="gpt-4o, claude-sonnet-4-5, ..."
        emptyText="Ningún modelo descubierto coincide -- podés dejarlo tal cual y escribirlo a mano."
      />
      {models.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {models.length} modelos disponibles -- escribí para filtrar, ej. "free".
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

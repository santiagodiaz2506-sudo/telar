import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, SendHorizonal } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { getTemplates, sendTemplateMessage } from '@/lib/endpoints'

/**
 * Fuera de la ventana de 24h, Meta solo deja iniciar con una plantilla ya
 * aprobada. El backend todavía no aplica los {{1}}, {{2}}... de `params`
 * (SendTemplateRequest los acepta pero send_template_message no los usa),
 * así que por ahora se manda la plantilla tal como está registrada.
 */
export function SendTemplateDialog({
  accountId,
  conversationId,
  open,
  onOpenChange,
  onSent,
}: {
  accountId: string
  conversationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}) {
  const [templateId, setTemplateId] = React.useState('')

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', accountId],
    queryFn: () => getTemplates(accountId),
    enabled: open,
  })

  const selected = templates?.find((t) => t.id === templateId)
  const hasVariables = selected?.components.some((c) => c.text?.includes('{{'))

  const send = useMutation({
    mutationFn: () => sendTemplateMessage(accountId, conversationId, templateId),
    onSuccess: () => {
      toast.success('Plantilla enviada')
      setTemplateId('')
      onOpenChange(false)
      onSent()
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : 'No se pudo enviar la plantilla'),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTemplateId('')
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar plantilla</DialogTitle>
          <DialogDescription>
            Se manda tal como está aprobada en Meta Business Manager — es lo único que Meta
            deja iniciar fuera de la ventana de 24 horas.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            send.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-picker">Plantilla</Label>
            <Select
              id="template-picker"
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Elegí una plantilla…</option>
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language})
                </option>
              ))}
            </Select>
            {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
            {!isLoading && templates?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Todavía no hay plantillas registradas para esta cuenta. Se registran con{' '}
                <code className="font-mono">POST /accounts/&#123;id&#125;/templates</code>.
              </p>
            )}
          </div>

          {selected && (
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              {selected.components.map((c, i) => (
                <p
                  key={i}
                  className="mb-1 text-[13px] whitespace-pre-wrap text-muted-foreground last:mb-0"
                >
                  {c.text ?? `[${c.type.toLowerCase()}]`}
                </p>
              ))}
              {hasVariables && (
                <p className="mt-2 text-[11.5px] text-status-pending">
                  Tiene variables ({'{{1}}'}, …) sin completar: Telar todavía no permite
                  reemplazarlas desde acá, se manda con los placeholders tal cual.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={send.isPending || !templateId}>
              {send.isPending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

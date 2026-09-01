import { MessageSquareText } from 'lucide-react'

import { EmptyState } from '@/components/EmptyState'

export function NoThreadSelected() {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <EmptyState
        weave
        icon={MessageSquareText}
        title="Elegí una conversación"
        description="Seleccioná una de la lista para leer el hilo, tomarla y responder. Podés moverte con las teclas j y k."
      />
    </div>
  )
}

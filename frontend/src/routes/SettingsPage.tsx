import { ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { InboxesTab } from '@/components/settings/InboxesTab'
import { KnowledgeBasesTab } from '@/components/settings/KnowledgeBasesTab'
import { ToolsTab } from '@/components/settings/ToolsTab'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'

type SettingsTab = 'inboxes' | 'tools' | 'knowledge-bases'

export function SettingsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const { roleForAccount } = useAuth()
  const [tab, setTab] = React.useState<SettingsTab>('inboxes')

  if (!accountId) return null
  const role = roleForAccount(accountId)

  if (!isAdmin(role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Sin acceso"
        description="La configuración de la cuenta -- inboxes, herramientas y bases de conocimiento -- es solo para administradores."
        className="flex-1"
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Configuración</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
          <TabsList>
            <TabsTrigger value="inboxes">Inboxes</TabsTrigger>
            <TabsTrigger value="tools">Herramientas</TabsTrigger>
            <TabsTrigger value="knowledge-bases">Bases de conocimiento</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl">
          {tab === 'inboxes' && <InboxesTab accountId={accountId} />}
          {tab === 'tools' && <ToolsTab accountId={accountId} />}
          {tab === 'knowledge-bases' && <KnowledgeBasesTab accountId={accountId} />}
        </div>
      </div>
    </div>
  )
}

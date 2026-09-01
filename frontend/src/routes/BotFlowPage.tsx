import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Braces, Loader2, Plus, Save, X } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AgentNode } from '@/components/flow/AgentNode'
import { EndpointNode } from '@/components/flow/EndpointNode'
import { NodeEditPanel } from '@/components/flow/NodeEditPanel'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { getAvailableTools, getBot, saveBot } from '@/lib/endpoints'
import {
  DEFAULT_GRAPH,
  flowToGraph,
  graphToFlow,
  newAgentNodeId,
  type AgentNodeData,
} from '@/lib/flowGraph'
import { useTheme } from '@/lib/theme'

const nodeTypes = { agent: AgentNode, endpoint: EndpointNode }

function BotFlowEditor({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient()
  const { resolved } = useTheme()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
  const [showJson, setShowJson] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  const { data: bot } = useQuery({ queryKey: ['bot', accountId], queryFn: () => getBot(accountId) })
  const { data: availableTools } = useQuery({
    queryKey: ['available-tools', accountId],
    queryFn: () => getAvailableTools(accountId),
  })

  React.useEffect(() => {
    if (hydrated || bot === undefined) return
    const { nodes: n, edges: e } = graphToFlow(bot?.graph ?? DEFAULT_GRAPH)
    setNodes(n)
    setEdges(e)
    setHydrated(true)
  }, [bot, hydrated, setNodes, setEdges])

  const saveMutation = useMutation({
    mutationFn: () => saveBot(accountId, bot?.name ?? 'Bot principal', flowToGraph(nodes, edges)),
    onSuccess: () => {
      setDirty(false)
      toast.success('Flujo guardado', {
        description: 'Reiniciá la API para que los cambios tomen efecto.',
      })
      queryClient.invalidateQueries({ queryKey: ['bot', accountId] })
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar el flujo')
    },
  })

  const onConnect = React.useCallback(
    (connection: Connection) => {
      setDirty(true)
      setEdges((current) => {
        // cada nodo admite un solo edge de salida: conectar uno nuevo
        // reemplaza al anterior, en vez de dejar crear algo que el
        // compilador va a rechazar de todas formas.
        const withoutOldOutgoing = current.filter((e) => e.source !== connection.source)
        return addEdge({ ...connection, animated: true }, withoutOldOutgoing)
      })
    },
    [setEdges],
  )

  function handleAddNode() {
    const id = newAgentNodeId()
    const maxX = nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
    setNodes((current) => [
      ...current,
      {
        id,
        type: 'agent',
        position: { x: maxX + 280, y: 260 },
        data: { systemPrompt: null, tools: null } satisfies AgentNodeData,
      },
    ])
    setSelectedNodeId(id)
    setDirty(true)
  }

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    setSelectedNodeId(node.type === 'agent' ? node.id : null)
  }

  function handleNodeDataChange(nodeId: string, data: AgentNodeData) {
    setNodes((current) => current.map((n) => (n.id === nodeId ? { ...n, data } : n)))
    setDirty(true)
  }

  function handleDeleteNode(nodeId: string) {
    setNodes((current) => current.filter((n) => n.id !== nodeId))
    setEdges((current) => current.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
    setDirty(true)
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const graphPreview = React.useMemo(() => flowToGraph(nodes, edges), [nodes, edges])
  const agentCount = nodes.filter((n) => n.type === 'agent').length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Barra de la pantalla: fuera del lienzo, no flotando encima */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Flujo del bot</h1>
        <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
          {agentCount} {agentCount === 1 ? 'nodo' : 'nodos'}
        </span>
        {bot && (
          <span className="text-xs text-muted-foreground">
            {bot.name} · v{bot.version}
          </span>
        )}
        {dirty && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-status-pending">
            <span className="size-1.5 rounded-full bg-status-pending" />
            Sin guardar
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddNode}>
            <Plus />
            Agregar nodo
          </Button>
          <Button
            variant={showJson ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowJson((v) => !v)}
            aria-pressed={showJson}
          >
            <Braces />
            JSON
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !dirty}
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            colorMode={resolved}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              className="!right-4 !bottom-4 !h-24 !w-40 !rounded-lg !border !border-border !bg-surface"
              maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
              nodeColor="var(--border-strong)"
            />
          </ReactFlow>

          <p className="pointer-events-none absolute top-3 left-3 rounded-md border border-border bg-surface/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            Cadena lineal: cada nodo se conecta a uno solo. Clic en un nodo para editarlo.
          </p>
        </div>

        {showJson && (
          <aside className="flex w-[380px] shrink-0 flex-col border-l border-border bg-surface">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
              <h2 className="flex-1 text-[13px] font-semibold">
                JSON del grafo
                <span className="ml-2 font-normal text-muted-foreground">
                  bot_versions.graph
                </span>
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowJson(false)}
                aria-label="Cerrar JSON"
              >
                <X />
              </Button>
            </header>
            <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
              {JSON.stringify(graphPreview, null, 2)}
            </pre>
          </aside>
        )}

        {selectedNode?.type === 'agent' && (
          <NodeEditPanel
            nodeId={selectedNode.id}
            data={selectedNode.data as AgentNodeData}
            availableTools={availableTools ?? []}
            onChange={(data) => handleNodeDataChange(selectedNode.id, data)}
            onDelete={() => handleDeleteNode(selectedNode.id)}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}

export function BotFlowPage() {
  const { accountId } = useParams<{ accountId: string }>()
  if (!accountId) return null

  return (
    <ReactFlowProvider>
      <BotFlowEditor accountId={accountId} />
    </ReactFlowProvider>
  )
}

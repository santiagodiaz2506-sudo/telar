import {
  Background,
  Controls,
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
import { Code2, Plus, Save } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AgentNode } from '@/components/flow/AgentNode'
import { EndpointNode } from '@/components/flow/EndpointNode'
import { NodeEditPanel } from '@/components/flow/NodeEditPanel'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { getAvailableTools, getBot, saveBot } from '@/lib/endpoints'
import { DEFAULT_GRAPH, flowToGraph, graphToFlow, newAgentNodeId, type AgentNodeData } from '@/lib/flowGraph'

const nodeTypes = { agent: AgentNode, endpoint: EndpointNode }

function BotFlowEditor({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
  const [showJson, setShowJson] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)

  const { data: bot } = useQuery({
    queryKey: ['bot', accountId],
    queryFn: () => getBot(accountId),
  })

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
      toast.success('Flujo guardado')
      queryClient.invalidateQueries({ queryKey: ['bot', accountId] })
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar el flujo')
    },
  })

  const onConnect = React.useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        // cada nodo admite un solo edge de salida: conectar uno nuevo
        // reemplaza al anterior, en vez de dejar crear algo que el
        // compilador va a rechazar de todas formas.
        const withoutOldOutgoing = current.filter((e) => e.source !== connection.source)
        return addEdge(connection, withoutOldOutgoing)
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
        position: { x: maxX + 260, y: 260 },
        data: { systemPrompt: null, tools: null } satisfies AgentNodeData,
      },
    ])
  }

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (node.type === 'agent') setSelectedNodeId(node.id)
  }

  function handleNodeDataChange(nodeId: string, data: AgentNodeData) {
    setNodes((current) => current.map((n) => (n.id === nodeId ? { ...n, data } : n)))
  }

  function handleDeleteNode(nodeId: string) {
    setNodes((current) => current.filter((n) => n.id !== nodeId))
    setEdges((current) => current.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const graphPreview = React.useMemo(() => flowToGraph(nodes, edges), [nodes, edges])

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>

        <div className="absolute top-4 left-4 flex gap-2">
          <Button size="sm" onClick={handleAddNode}>
            <Plus className="size-4" /> Agregar nodo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowJson((v) => !v)}>
            <Code2 className="size-4" /> Ver JSON
          </Button>
        </div>

        <div className="absolute top-4 right-4">
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="size-4" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>

        {showJson && (
          <pre className="absolute bottom-4 left-4 max-h-64 max-w-md overflow-auto rounded-md border bg-card p-3 text-xs shadow-sm">
            {JSON.stringify(graphPreview, null, 2)}
          </pre>
        )}
      </div>

      {selectedNode && selectedNode.type === 'agent' && (
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

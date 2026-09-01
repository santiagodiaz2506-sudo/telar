import type { Edge, Node } from '@xyflow/react'

import type { BotGraph, GraphNode } from '@/types/api'

export const DEFAULT_GRAPH: BotGraph = {
  nodes: [{ id: 'agente_1', type: 'agent', system_prompt: null, tools: null }],
  edges: [
    { from: 'START', to: 'agente_1' },
    { from: 'agente_1', to: 'END' },
  ],
}

const X_SPACING = 260
const ROW_Y = 120

export interface AgentNodeData {
  [key: string]: unknown
  systemPrompt: string | null
  tools: string[] | null
}

export interface EndpointNodeData {
  [key: string]: unknown
  label: 'START' | 'END'
}

/**
 * El JSON no guarda posición visual (v0 del compilador solo permite
 * cadenas lineales, sin ramas) -- el layout se recalcula siempre
 * siguiendo los edges desde START, en línea, de izquierda a derecha.
 */
export function graphToFlow(graph: BotGraph): { nodes: Node[]; edges: Edge[] } {
  const nextOf = new Map(graph.edges.map((e) => [e.from, e.to]))
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]))

  const order: string[] = ['START']
  let current = nextOf.get('START')
  const seen = new Set(['START'])
  while (current && current !== 'END' && !seen.has(current)) {
    order.push(current)
    seen.add(current)
    current = nextOf.get(current)
  }
  order.push('END')

  const nodes: Node[] = order.map((id, i) => {
    const position = { x: i * X_SPACING, y: ROW_Y }
    if (id === 'START' || id === 'END') {
      const data: EndpointNodeData = { label: id }
      return { id, type: 'endpoint', position, data, draggable: false, deletable: false }
    }
    const graphNode = nodesById.get(id)
    const data: AgentNodeData = {
      systemPrompt: graphNode?.system_prompt ?? null,
      tools: graphNode?.tools ?? null,
    }
    return { id, type: 'agent', position, data }
  })

  const edges: Edge[] = graph.edges.map((e) => ({
    id: `${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
  }))

  return { nodes, edges }
}

export function flowToGraph(nodes: Node[], edges: Edge[]): BotGraph {
  const graphNodes: GraphNode[] = nodes
    .filter((n) => n.type === 'agent')
    .map((n) => {
      const data = n.data as AgentNodeData
      return {
        id: n.id,
        type: 'agent',
        system_prompt: data.systemPrompt || null,
        tools: data.tools,
      }
    })

  const graphEdges = edges.map((e) => ({ from: e.source, to: e.target }))

  return { nodes: graphNodes, edges: graphEdges }
}

let nodeCounter = 0

export function newAgentNodeId(): string {
  nodeCounter += 1
  return `agente_${Date.now()}_${nodeCounter}`
}

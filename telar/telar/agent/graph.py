"""
Grafo del agente, versión mínima.

En el v0 el grafo está escrito a mano. El compilador que traduce el JSON del
canvas visual a este mismo StateGraph viene después: la firma de build_graph
no cambia, solo su implementación.
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from telar.agent.tools import consultar_base_de_conocimiento, escalar_a_humano
from telar.llm.registry import get_model

TOOLS = [escalar_a_humano, consultar_base_de_conocimiento]


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    system_prompt: str
    account_id: str


def build_graph(model_spec: str | None = None, checkpointer=None):
    model = get_model(model_spec).bind_tools(TOOLS)

    async def agent(state: AgentState):
        messages = [SystemMessage(content=state["system_prompt"]), *state["messages"]]
        return {"messages": [await model.ainvoke(messages)]}

    def route(state: AgentState):
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent)
    graph.add_node("tools", ToolNode(TOOLS))
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile(checkpointer=checkpointer)

"""
El pipeline: de un lote de mensajes entrantes a una respuesta enviada.

Aquí vive la guarda del handoff. Si un humano tiene la conversación, este
código persiste el mensaje y no invoca el grafo. Es la diferencia entre un
producto usable y un bot que le habla encima al asesor.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from telar.agent.graph import build_graph
from telar.channels.meta import MetaWhatsAppAdapter
from telar.config import settings
from telar.core import state as st
from telar.core.types import InboundMessage, OutboundMessage, SenderType
from telar.db import repositories as repo
from telar.db.pool import get_pool

log = logging.getLogger(__name__)


class Pipeline:
    def __init__(self, adapter: MetaWhatsAppAdapter) -> None:
        self.adapter = adapter
        self._graph = None

    async def _get_graph(self):
        if self._graph is None:
            pool = await get_pool()
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()
            self._graph = build_graph(checkpointer=checkpointer)
        return self._graph

    async def handle(self, batch: list[InboundMessage]) -> None:
        first = batch[0]

        contact_id = await repo.upsert_contact(first.account_id, first.contact)
        conv = await repo.get_or_create_conversation(
            first.account_id, first.inbox_id, contact_id, bot_id=None
        )

        for msg in batch:
            await repo.save_inbound(msg, conv.id)
            if msg.channel_message_id:
                await self.adapter.mark_read(msg.channel_message_id)

        st.on_inbound(conv)
        await repo.save_conversation(conv)

        # La guarda. Un humano tiene la conversación: no generamos nada.
        if not st.should_bot_reply(conv):
            log.info("conversación %s en estado %s, el bot no responde",
                     conv.id, conv.status.value)
            return

        text = "\n".join(m.as_agent_text() for m in batch)
        graph = await self._get_graph()

        result = await graph.ainvoke(
            {
                "messages": [HumanMessage(content=text)],
                "system_prompt": settings().default_system_prompt,
            },
            config={"configurable": {"thread_id": str(conv.id)}},
        )

        reply = result["messages"][-1]
        answer = reply.content if isinstance(reply.content, str) else str(reply.content)

        if answer.strip():
            await self._send(conv, first, answer)

        # Si el agente pidió transferir, soltamos la conversación.
        if any("TRANSFERIR:" in str(m.content) for m in result["messages"][-3:]):
            st.request_handoff(conv, team_id=conv.team_id)
            await repo.save_conversation(conv)
            log.info("conversación %s transferida a humano", conv.id)

    async def _send(self, conv, inbound: InboundMessage, text: str) -> None:
        if not st.window_is_open(conv):
            log.warning("ventana de 24h cerrada en %s: se requiere plantilla", conv.id)
            return

        out = OutboundMessage(
            conversation_id=conv.id, sender_type=SenderType.BOT, text=text
        )
        result = await self.adapter.send(out, inbound.contact)
        await repo.save_outbound(
            out, inbound.account_id, inbound.inbox_id, result.channel_message_id
        )
        if not result.ok:
            log.error("no se pudo enviar: %s %s", result.error_code, result.error_message)

"""
El pipeline: de un lote de mensajes entrantes a una respuesta enviada.

Aquí vive la guarda del handoff. Si un humano tiene la conversación, este
código persiste el mensaje y no invoca el grafo. Es la diferencia entre un
producto usable y un bot que le habla encima al asesor.
"""

from __future__ import annotations

import asyncio
import logging

from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from telar.agent.graph import build_graph
from telar.agent.tools import escalar_a_humano
from telar.channels.meta import MetaWhatsAppAdapter
from telar.config import settings
from telar.core import state as st
from telar.core.types import InboundMessage, OutboundMessage, SenderType
from telar.custom_tools.loader import build_custom_tools
from telar.db import repositories as repo
from telar.db.pool import get_pool

log = logging.getLogger(__name__)


class Pipeline:
    def __init__(self, adapter: MetaWhatsAppAdapter) -> None:
        self.adapter = adapter
        # Un grafo por cuenta: cada una puede tener sus propias tools
        # configurables, y bind_tools() necesita conocer la lista completa
        # de antemano. Limitación v0: si se agrega/edita una tool hace
        # falta reiniciar el proceso para que la cuenta la vea.
        self._graphs: dict[str, object] = {}
        self._checkpointer = None
        # Tope global de invocaciones concurrentes al LLM: protege el pool
        # de Postgres y el rate limit del proveedor de un pico de tráfico.
        self._semaphore = asyncio.Semaphore(
            settings().rate_limit_max_concurrent_agent_calls
        )

    async def _get_checkpointer(self):
        if self._checkpointer is None:
            pool = await get_pool()
            self._checkpointer = AsyncPostgresSaver(pool)
            await self._checkpointer.setup()
        return self._checkpointer

    async def _get_graph(self, account_id):
        key = str(account_id)
        if key not in self._graphs:
            checkpointer = await self._get_checkpointer()
            extra_tools = await build_custom_tools(account_id)
            self._graphs[key] = build_graph(checkpointer=checkpointer, extra_tools=extra_tools)
        return self._graphs[key]

    async def handle(self, batch: list[InboundMessage]) -> None:
        first = batch[0]

        contact_id = await repo.upsert_contact(first.account_id, first.contact)
        conv = await repo.get_or_create_conversation(
            first.account_id, first.inbox_id, contact_id, bot_id=None
        )

        # save_inbound devuelve None si el mensaje ya estaba guardado (Meta
        # reintenta el webhook). Solo los mensajes nuevos entran al turno del
        # agente: si dos reintentos caen en ventanas de debounce distintas,
        # esto evita que el bot invoque al LLM y responda dos veces.
        new_messages = []
        for msg in batch:
            inserted_id = await repo.save_inbound(msg, conv.id)
            if msg.channel_message_id:
                await self.adapter.mark_read(msg.channel_message_id)
            if inserted_id is not None:
                new_messages.append(msg)

        st.on_inbound(conv)
        await repo.save_conversation(conv)

        # La guarda. Un humano tiene la conversación: no generamos nada.
        if not st.should_bot_reply(conv):
            log.info("conversación %s en estado %s, el bot no responde",
                     conv.id, conv.status.value)
            return

        if not new_messages:
            log.info("conversación %s: lote ya procesado (reintento de Meta)", conv.id)
            return

        text = "\n".join(m.as_agent_text() for m in new_messages)
        graph = await self._get_graph(conv.account_id)

        async with self._semaphore:
            result = await graph.ainvoke(
                {
                    "messages": [HumanMessage(content=text)],
                    "system_prompt": settings().default_system_prompt,
                    "account_id": str(conv.account_id),
                },
                config={"configurable": {"thread_id": str(conv.id)}},
            )

        reply = result["messages"][-1]
        answer = reply.content if isinstance(reply.content, str) else str(reply.content)

        if answer.strip():
            await self._send(conv, first, answer)

        # Si el agente llamó a la tool de handoff, soltamos la conversación.
        # Se inspecciona el ToolMessage de la ejecución, no el texto de la
        # respuesta: así no depende de lo que la tool devuelva como string.
        if any(
            isinstance(m, ToolMessage) and m.name == escalar_a_humano.name
            for m in result["messages"][-3:]
        ):
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

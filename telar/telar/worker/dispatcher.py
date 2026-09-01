"""
Frontera asíncrona entre el webhook y el agente.

El v0 no usa Redis: agrupa en memoria y procesa con asyncio. La deuda
conocida es que un reinicio pierde los mensajes en vuelo del buffer. Cuando
eso duela, esta clase se reemplaza por un productor a Redis Streams y nada
más del proyecto cambia.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from telar.config import settings
from telar.core.ratelimit import SlidingWindowLimiter
from telar.core.types import InboundMessage

log = logging.getLogger(__name__)


class Dispatcher:
    def __init__(self, handler, debounce: float | None = None) -> None:
        self._handler = handler
        self._debounce = debounce if debounce is not None else settings().debounce_seconds
        self._buffers: dict[str, list[InboundMessage]] = defaultdict(list)
        self._timers: dict[str, asyncio.Task] = {}
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._limiter = SlidingWindowLimiter(
            max_events=settings().rate_limit_messages_per_window,
            window_seconds=settings().rate_limit_window_seconds,
        )

    def submit(self, msg: InboundMessage) -> None:
        """
        No bloquea: el webhook responde 200 de inmediato. La gente manda tres
        mensajes seguidos, así que reiniciamos el temporizador en cada uno y
        el agente ve la ráfaga completa como un solo turno.
        """
        key = self._key(msg)

        # Anti-abuso: un contacto que manda mensajes en bucle no debe poder
        # disparar llamadas ilimitadas al LLM ni llenar el buffer de debounce.
        if not self._limiter.allow(key):
            log.warning("limite de mensajes excedido para %s, se descarta", key)
            return

        self._buffers[key].append(msg)

        timer = self._timers.get(key)
        if timer and not timer.done():
            timer.cancel()

        self._timers[key] = asyncio.create_task(self._wait_and_run(key))

    async def _wait_and_run(self, key: str) -> None:
        try:
            await asyncio.sleep(self._debounce)
        except asyncio.CancelledError:
            return

        # El lock garantiza orden por contacto: dos ráfagas seguidas no se
        # procesan en paralelo y no se cruzan las respuestas.
        async with self._locks[key]:
            batch = self._buffers.pop(key, [])
            self._timers.pop(key, None)
            if not batch:
                return
            try:
                await self._handler(batch)
            except Exception:
                log.exception("fallo procesando lote de %s", key)

    @staticmethod
    def _key(msg: InboundMessage) -> str:
        return f"{msg.inbox_id}:{msg.contact.external_id}"

    async def drain(self) -> None:
        """Para el apagado ordenado: espera lo que quede en vuelo."""
        pending = [t for t in self._timers.values() if not t.done()]
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

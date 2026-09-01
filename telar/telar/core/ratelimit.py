"""
Limitador de tasa por ventana deslizante, en memoria.

v0 no usa Redis (mismo trade-off que worker/dispatcher.py): un reinicio
resetea los contadores. Se reutiliza tanto para el volumen de mensajes por
contacto de WhatsApp como para los intentos de login.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: float) -> None:
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits[key]
        cutoff = now - self.window_seconds

        while hits and hits[0] < cutoff:
            hits.popleft()

        if len(hits) >= self.max_events:
            return False

        hits.append(now)
        return True

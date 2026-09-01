"""Tests del limitador de tasa de ventana deslizante. Lógica pura, sin DB."""

from __future__ import annotations

import time

from telar.core.ratelimit import SlidingWindowLimiter


def test_allows_up_to_the_limit():
    limiter = SlidingWindowLimiter(max_events=3, window_seconds=60)
    assert [limiter.allow("a") for _ in range(3)] == [True, True, True]


def test_blocks_past_the_limit():
    limiter = SlidingWindowLimiter(max_events=3, window_seconds=60)
    for _ in range(3):
        limiter.allow("a")
    assert limiter.allow("a") is False


def test_keys_do_not_interfere():
    limiter = SlidingWindowLimiter(max_events=1, window_seconds=60)
    assert limiter.allow("a") is True
    assert limiter.allow("a") is False
    assert limiter.allow("b") is True


def test_resets_after_the_window_passes():
    limiter = SlidingWindowLimiter(max_events=1, window_seconds=0.05)
    assert limiter.allow("a") is True
    assert limiter.allow("a") is False
    time.sleep(0.1)
    assert limiter.allow("a") is True

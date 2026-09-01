"""
Registro de modelos. No construimos abstracción propia: init_chat_model de
LangChain ya resuelve el multi-proveedor con la cadena "proveedor:modelo".
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from langchain.chat_models import init_chat_model

from telar.config import settings


@lru_cache(maxsize=32)
def _cached(spec: str, frozen_params: tuple) -> Any:
    return init_chat_model(spec, **dict(frozen_params))


def get_model(spec: str | None = None, **params: Any):
    """
    spec admite "anthropic:claude-sonnet-4-5", "openai:gpt-4.1",
    "ollama:llama3.1", "openrouter:...". Para Ollama u OpenRouter, la
    base_url va en params o en las variables de entorno del proveedor.
    """
    spec = spec or settings().default_model
    return _cached(spec, tuple(sorted(params.items())))

"""
Arma las tools configurables (http, sql) de una cuenta como BaseTool de
LangChain, listas para sumarse a TOOLS antes de bind_tools().
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from langchain_core.tools import BaseTool

from telar.core import crypto
from telar.custom_tools.http_tool import build_http_tool
from telar.custom_tools.sql_tool import build_sql_tool
from telar.db import repositories as repo

log = logging.getLogger(__name__)

_BUILDERS = {
    "http": build_http_tool,
    "sql": build_sql_tool,
}


async def build_custom_tools(account_id: UUID) -> list[BaseTool]:
    rows = await repo.get_tools_for_account(account_id)
    tools: list[BaseTool] = []

    for row in rows:
        builder = _BUILDERS.get(row["kind"])
        if builder is None:
            continue  # kb/handoff son las tools fijas, no configurables

        try:
            secret = _decrypt_secret(row.get("secret_config"))
            tools.append(builder(row, secret))
        except Exception:
            log.exception(
                "no se pudo armar la tool %s (cuenta %s), se omite",
                row.get("name"), account_id,
            )

    return tools


def _decrypt_secret(secret_config: bytes | None) -> dict[str, Any]:
    if not secret_config:
        return {}
    return json.loads(crypto.decrypt(secret_config.decode()))

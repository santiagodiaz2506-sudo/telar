"""
Tool SQL configurable por cuenta, contra una base Postgres externa que la
cuenta trae (Telar no tiene datos de negocio propios que consultar).

Siempre de solo lectura: la conexión se marca read-only con
psycopg (Connection.set_read_only), que Postgres hace cumplir a nivel de
motor -- no es un chequeo de texto adivinando si la query es segura. El
chequeo de prefijo SELECT/WITH es una barrera rápida adicional, no la
protección real.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import psycopg
from langchain_core.tools import StructuredTool
from psycopg.rows import dict_row

from telar.custom_tools.schema import build_args_model

log = logging.getLogger(__name__)

_MAX_ROWS = 20
_READONLY_PREFIX = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)


class UnsafeQueryError(Exception):
    pass


def check_query_is_readonly(query: str) -> None:
    if not _READONLY_PREFIX.match(query):
        raise UnsafeQueryError("la query debe empezar con SELECT o WITH")


def build_sql_tool(row: dict[str, Any], secret: dict[str, Any]) -> StructuredTool:
    query = row["config"]["query"]
    connection_string = secret["connection_string"]

    # Se valida al construir la tool, antes de exponerla al agente.
    check_query_is_readonly(query)

    args_model = build_args_model(row["schema"], model_name=f"{row['name']}_args")

    async def _run(**kwargs: Any) -> str:
        # ToolNode no atrapa excepciones arbitrarias por default: sin este
        # try/except, una base externa caída tumbaría el turno completo.
        try:
            check_query_is_readonly(query)

            conn = await psycopg.AsyncConnection.connect(
                connection_string, autocommit=False, connect_timeout=10
            )
            try:
                await conn.set_read_only(True)
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(query, kwargs)
                    rows = await cur.fetchmany(_MAX_ROWS)
            finally:
                await conn.rollback()
                await conn.close()
        except UnsafeQueryError as e:
            log.error("tool %s: query no permitida (%s)", row["name"], e)
            return "Esta herramienta está mal configurada y no se puede usar."
        except Exception:
            log.exception("tool %s: fallo consultando la base externa", row["name"])
            return "No se pudo consultar la herramienta externa en este momento."

        if not rows:
            return "Sin resultados."
        return str(rows)

    return StructuredTool.from_function(
        coroutine=_run,
        name=row["name"],
        description=row["description"],
        args_schema=args_model,
    )

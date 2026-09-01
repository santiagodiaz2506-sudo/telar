"""
Bootstrap de una tool configurable (http/sql). v0 no tiene API de
administración: se define en un archivo JSON local y se inserta a mano,
igual que cuenta, inbox, base de conocimiento y usuario (ver README).

Formato del archivo:
    {
        "name": "consultar_pedido",
        "description": "Busca el estado de un pedido por su numero.",
        "kind": "http",
        "config": {"url": "https://api.miempresa.com/pedidos", "method": "GET"},
        "secret": {"headers": {"Authorization": "Bearer ..."}},
        "schema": {
            "properties": {"order_id": {"type": "string", "description": "numero de pedido"}},
            "required": ["order_id"]
        }
    }

El archivo tiene un secreto real en texto plano -- borralo después de
correr el script.

Uso:
    python -m telar.custom_tools.create_tool <account_id> tool.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from uuid import UUID

from telar.core import crypto
from telar.custom_tools.http_tool import UnsafeURLError, check_url_is_safe
from telar.custom_tools.sql_tool import UnsafeQueryError, check_query_is_readonly
from telar.db import repositories as repo


async def create_tool(account_id: UUID, definition: dict) -> None:
    kind = definition["kind"]
    config = definition["config"]

    # Se valida antes de guardar, para no dejar creada una tool que nunca
    # va a poder ejecutarse (o que sea insegura desde el vamos).
    try:
        if kind == "http":
            check_url_is_safe(config["url"])
        elif kind == "sql":
            check_query_is_readonly(config["query"])
        else:
            raise SystemExit(f"kind no soportado: {kind!r} (usar 'http' o 'sql')")
    except (UnsafeURLError, UnsafeQueryError) as e:
        raise SystemExit(f"Definición rechazada: {e}") from None

    secret = definition.get("secret") or {}
    secret_config = crypto.encrypt(json.dumps(secret)).encode() if secret else None

    tool_id = await repo.insert_tool(
        account_id,
        definition["name"],
        definition["description"],
        kind,
        config,
        secret_config,
        definition.get("schema", {}),
    )
    print(f"Tool creada: {tool_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea una tool configurable (http/sql).")
    parser.add_argument("account_id", type=UUID)
    parser.add_argument("file", type=Path)
    args = parser.parse_args()

    definition = json.loads(args.file.read_text(encoding="utf-8"))
    asyncio.run(create_tool(args.account_id, definition))
    print("Recordá borrar el archivo: tiene un secreto en texto plano.")


if __name__ == "__main__":
    main()

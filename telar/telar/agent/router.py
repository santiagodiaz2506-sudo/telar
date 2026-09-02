"""
Endpoint HTTP para el bot de la cuenta -- la contraparte del CLI
deploy_bot.py. "El bot de la cuenta" es singular a propósito: ver
db/repositories.py get_bot_for_account.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from telar.agent import graph_cache
from telar.agent.compiler import GraphCompileError, compile_graph
from telar.agent.graph import TOOLS
from telar.auth.dependencies import Membership, require_role
from telar.auth.roles import AccountRole
from telar.custom_tools.loader import build_custom_tools
from telar.db import repositories as repo

router = APIRouter(prefix="/accounts/{account_id}/bot", tags=["bot"])


class BotResponse(BaseModel):
    id: UUID
    name: str
    version: int
    graph: dict[str, Any]


class SaveBotRequest(BaseModel):
    name: str = "Bot principal"
    graph: dict[str, Any]
    notes: str | None = None


class BotVersionResponse(BaseModel):
    id: UUID
    version: int
    notes: str | None
    created_by: UUID | None
    created_at: datetime
    is_active: bool


class AvailableToolResponse(BaseModel):
    name: str
    description: str


async def _get_bot_or_404(account_id: UUID) -> dict:
    bot = await repo.get_bot_for_account(account_id)
    if bot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La cuenta todavía no tiene un bot")
    return bot


@router.get("", response_model=BotResponse | None)
async def get_bot(
    account_id: UUID, membership: Membership = Depends(require_role())
) -> BotResponse | None:
    bot = await repo.get_bot_for_account(account_id)
    if bot is None or bot["active_version_id"] is None:
        return None

    version = await repo.get_bot_version(bot["active_version_id"])
    if version is None:
        return None

    return BotResponse(
        id=bot["id"], name=bot["name"], version=version["version"], graph=version["graph"]
    )


@router.put("", response_model=BotResponse)
async def save_bot(
    account_id: UUID,
    body: SaveBotRequest,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> BotResponse:
    # Se compila de verdad, con las tools reales de la cuenta, antes de
    # guardar nada -- mismo chequeo que ya usa deploy_bot.py.
    extra_tools = await build_custom_tools(account_id)
    try:
        compile_graph(body.graph, available_tools=TOOLS + extra_tools)
    except GraphCompileError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e

    bot = await repo.get_bot_for_account(account_id)
    bot_id = bot["id"] if bot else await repo.insert_bot(account_id, body.name)

    version = await repo.get_next_bot_version(bot_id)
    version_id = await repo.insert_bot_version(
        bot_id, version, body.graph, notes=body.notes, created_by=membership.user_id
    )
    await repo.set_active_bot_version(bot_id, version_id)
    graph_cache.invalidate(account_id)

    return BotResponse(id=bot_id, name=body.name, version=version, graph=body.graph)


@router.get("/versions", response_model=list[BotVersionResponse])
async def list_bot_versions(
    account_id: UUID, membership: Membership = Depends(require_role())
) -> list[BotVersionResponse]:
    bot = await _get_bot_or_404(account_id)
    rows = await repo.list_bot_versions(bot["id"])
    return [BotVersionResponse(**row) for row in rows]


@router.post("/versions/{version_id}/activate", response_model=BotVersionResponse)
async def activate_bot_version(
    account_id: UUID,
    version_id: UUID,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> BotVersionResponse:
    """Rollback (o forward) a una versión ya guardada, sin recompilar nada nuevo."""
    bot = await _get_bot_or_404(account_id)
    version = await repo.get_bot_version(version_id)
    if version is None or version["bot_id"] != bot["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Versión no encontrada")

    await repo.set_active_bot_version(bot["id"], version_id)
    graph_cache.invalidate(account_id)

    versions = await repo.list_bot_versions(bot["id"])
    activated = next(v for v in versions if v["id"] == version_id)
    return BotVersionResponse(**activated)


@router.get("/available-tools", response_model=list[AvailableToolResponse])
async def list_available_tools(
    account_id: UUID, membership: Membership = Depends(require_role())
) -> list[AvailableToolResponse]:
    extra_tools = await build_custom_tools(account_id)
    return [
        AvailableToolResponse(name=t.name, description=t.description)
        for t in TOOLS + extra_tools
    ]

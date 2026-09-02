"""
Administración de proveedores LLM por cuenta -- conecta la tabla
llm_providers (existía desde 001_init.sql, sin usar) con un CRUD real y con
el compilador del grafo. Como máximo un proveedor por cuenta puede estar
activo (ver db/repositories.py set_active_llm_provider); el que esté activo
es el que usan los nodos "agent" del bot de esa cuenta -- si ninguno está
activo, se sigue usando el modelo global por defecto (sin cambios).
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from telar.agent import graph_cache
from telar.auth.dependencies import Membership, require_role
from telar.auth.roles import AccountRole
from telar.core import crypto
from telar.db import repositories as repo
from telar.llm.discovery import DiscoveryError, list_models

router = APIRouter(prefix="/accounts/{account_id}/llm-providers", tags=["llm-providers"])

ProviderKind = Literal["openai", "anthropic", "openrouter", "ollama"]


class LlmProviderResponse(BaseModel):
    id: UUID
    name: str
    provider: str
    model: str
    base_url: str | None
    is_active: bool


class CreateLlmProviderRequest(BaseModel):
    name: str
    provider: ProviderKind
    model: str
    base_url: str | None = None
    api_key: str | None = None


class UpdateLlmProviderRequest(BaseModel):
    name: str
    model: str
    base_url: str | None = None
    api_key: str | None = None  # None = no tocar la key guardada


class DiscoverModelsRequest(BaseModel):
    provider: ProviderKind
    base_url: str | None = None
    api_key: str | None = None


class DiscoverModelsResponse(BaseModel):
    models: list[str]


async def _get_provider_or_404(account_id: UUID, provider_id: UUID) -> dict:
    provider = await repo.get_llm_provider(provider_id)
    if provider is None or provider["account_id"] != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proveedor no encontrado")
    return provider


@router.get("", response_model=list[LlmProviderResponse])
async def list_llm_providers(
    account_id: UUID, membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR))
) -> list[LlmProviderResponse]:
    rows = await repo.list_llm_providers(account_id)
    return [LlmProviderResponse(**row) for row in rows]


@router.post("", response_model=LlmProviderResponse)
async def create_llm_provider(
    account_id: UUID,
    body: CreateLlmProviderRequest,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> LlmProviderResponse:
    api_key = crypto.encrypt(body.api_key).encode() if body.api_key else None
    provider_id = await repo.insert_llm_provider(
        account_id, body.name, body.provider, body.model, body.base_url, api_key
    )
    return LlmProviderResponse(
        id=provider_id, name=body.name, provider=body.provider, model=body.model,
        base_url=body.base_url, is_active=False,
    )


@router.patch("/{provider_id}", response_model=LlmProviderResponse)
async def update_llm_provider(
    account_id: UUID,
    provider_id: UUID,
    body: UpdateLlmProviderRequest,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> LlmProviderResponse:
    existing = await _get_provider_or_404(account_id, provider_id)
    await repo.update_llm_provider(provider_id, body.name, body.model, body.base_url)
    if body.api_key:
        await repo.update_llm_provider_secret(provider_id, crypto.encrypt(body.api_key).encode())
    if existing["is_active"]:
        graph_cache.invalidate(account_id)

    return LlmProviderResponse(
        id=provider_id, name=body.name, provider=existing["provider"], model=body.model,
        base_url=body.base_url, is_active=existing["is_active"],
    )


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_llm_provider(
    account_id: UUID,
    provider_id: UUID,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> None:
    existing = await _get_provider_or_404(account_id, provider_id)
    await repo.delete_llm_provider(provider_id)
    if existing["is_active"]:
        graph_cache.invalidate(account_id)


@router.post("/{provider_id}/activate", response_model=LlmProviderResponse)
async def activate_llm_provider(
    account_id: UUID,
    provider_id: UUID,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> LlmProviderResponse:
    await _get_provider_or_404(account_id, provider_id)
    await repo.set_active_llm_provider(account_id, provider_id)
    graph_cache.invalidate(account_id)

    updated = await _get_provider_or_404(account_id, provider_id)
    return LlmProviderResponse(**updated)


@router.post("/discover-models", response_model=DiscoverModelsResponse)
async def discover_models(
    account_id: UUID,
    body: DiscoverModelsRequest,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> DiscoverModelsResponse:
    try:
        models = await list_models(body.provider, body.base_url, body.api_key)
    except DiscoveryError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    return DiscoverModelsResponse(models=models)

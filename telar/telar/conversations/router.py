"""
Bandeja de entrada: ver, tomar y responder conversaciones como agente
humano, y contactos/informes básicos.

Nombre del paquete elegido para no confundir con la tabla `inboxes`
(los números de WhatsApp configurados, un concepto distinto).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from telar.auth.dependencies import Membership, require_role
from telar.auth.roles import AccountRole
from telar.channels.meta import default_adapter
from telar.core import state as st
from telar.core.types import ContactRef, ConversationStatus, OutboundMessage, SenderType
from telar.db import repositories as repo

router = APIRouter(prefix="/accounts/{account_id}", tags=["conversations"])
adapter = default_adapter()

_ELEVATED_ROLES = (AccountRole.ADMINISTRATOR, AccountRole.SUPERVISOR)


class ConversationResponse(BaseModel):
    id: UUID
    status: str
    assignee_id: UUID | None
    contact_id: UUID
    contact_name: str | None
    contact_phone: str | None
    last_contact_message_at: datetime | None


class ConversationStatusResponse(BaseModel):
    id: UUID
    status: str
    assignee_id: UUID | None


class MessageResponse(BaseModel):
    id: UUID
    sender_type: str
    sender_id: UUID | None
    type: str
    content: str | None
    created_at: datetime


class ConversationDetailResponse(BaseModel):
    id: UUID
    status: str
    assignee_id: UUID | None
    contact_id: UUID
    messages: list[MessageResponse]


class AssignRequest(BaseModel):
    assignee_id: UUID | None = None  # vacío = tomarla para uno mismo


class SendMessageRequest(BaseModel):
    text: str


class ContactResponse(BaseModel):
    id: UUID
    external_id: str
    name: str | None
    phone: str | None


class StatsResponse(BaseModel):
    bot: int
    pending: int
    open: int
    resolved: int


async def _get_conversation_or_404(account_id: UUID, conversation_id: UUID):
    conv = await repo.get_conversation(conversation_id)
    if conv is None or conv.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversación no encontrada")
    return conv


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    account_id: UUID,
    status_filter: Literal["bot", "pending", "open", "resolved"] | None = None,
    limit: int = 50,
    offset: int = 0,
    membership: Membership = Depends(require_role()),
) -> list[ConversationResponse]:
    rows = await repo.get_conversations_for_account(account_id, status_filter, limit, offset)
    return [
        ConversationResponse(
            id=r["id"],
            status=r["status"],
            assignee_id=r["assignee_id"],
            contact_id=r["contact_id"],
            contact_name=r["contact_name"],
            contact_phone=r["contact_phone"],
            last_contact_message_at=r["last_contact_message_at"],
        )
        for r in rows
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation_detail(
    account_id: UUID,
    conversation_id: UUID,
    membership: Membership = Depends(require_role()),
) -> ConversationDetailResponse:
    conv = await _get_conversation_or_404(account_id, conversation_id)
    messages = await repo.get_messages_for_conversation(conversation_id)
    return ConversationDetailResponse(
        id=conv.id,
        status=conv.status.value,
        assignee_id=conv.assignee_id,
        contact_id=conv.contact_id,
        messages=[MessageResponse(**m) for m in messages],
    )


@router.post("/conversations/{conversation_id}/assign", response_model=ConversationStatusResponse)
async def assign_conversation(
    account_id: UUID,
    conversation_id: UUID,
    body: AssignRequest,
    membership: Membership = Depends(require_role()),
) -> ConversationStatusResponse:
    conv = await _get_conversation_or_404(account_id, conversation_id)

    target_id = body.assignee_id or membership.user_id
    is_self = target_id == membership.user_id
    can_assign_others = membership.is_superadmin or membership.role in _ELEVATED_ROLES
    if not is_self and not can_assign_others:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No podés asignar a otra persona")

    try:
        if conv.status is ConversationStatus.OPEN:
            # No es un cambio de estado, solo de asignado: no pasa por
            # la máquina de estados.
            conv.assignee_id = target_id
        else:
            st.transition(conv, ConversationStatus.OPEN, assignee_id=target_id)
    except st.InvalidTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e

    await repo.save_conversation(conv)
    return ConversationStatusResponse(id=conv.id, status=conv.status.value, assignee_id=conv.assignee_id)


@router.post("/conversations/{conversation_id}/resolve", response_model=ConversationStatusResponse)
async def resolve_conversation(
    account_id: UUID,
    conversation_id: UUID,
    membership: Membership = Depends(require_role()),
) -> ConversationStatusResponse:
    conv = await _get_conversation_or_404(account_id, conversation_id)

    try:
        st.transition(conv, ConversationStatus.RESOLVED)
    except st.InvalidTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e

    await repo.save_conversation(conv)
    return ConversationStatusResponse(id=conv.id, status=conv.status.value, assignee_id=conv.assignee_id)


@router.post("/conversations/{conversation_id}/release", response_model=ConversationStatusResponse)
async def release_conversation(
    account_id: UUID,
    conversation_id: UUID,
    membership: Membership = Depends(require_role()),
) -> ConversationStatusResponse:
    conv = await _get_conversation_or_404(account_id, conversation_id)

    try:
        st.request_handoff(conv)
    except st.InvalidTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e

    await repo.save_conversation(conv)
    return ConversationStatusResponse(id=conv.id, status=conv.status.value, assignee_id=conv.assignee_id)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    account_id: UUID,
    conversation_id: UUID,
    body: SendMessageRequest,
    membership: Membership = Depends(require_role()),
) -> MessageResponse:
    conv = await _get_conversation_or_404(account_id, conversation_id)

    if conv.status is not ConversationStatus.OPEN:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Hay que tomar la conversación antes de responder"
        )

    is_owner = conv.assignee_id == membership.user_id
    can_override = membership.is_superadmin or membership.role in _ELEVATED_ROLES
    if not is_owner and not can_override:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta conversación la tiene otra persona")

    if not st.window_is_open(conv):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ventana de 24h cerrada, se necesita una plantilla"
        )

    contact = await repo.get_contact(conv.contact_id)
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contacto no encontrado")

    out = OutboundMessage(
        conversation_id=conv.id,
        sender_type=SenderType.AGENT,
        sender_id=membership.user_id,
        text=body.text,
    )
    contact_ref = ContactRef(
        external_id=contact["external_id"], name=contact["name"], phone=contact["phone"]
    )
    result = await adapter.send(out, contact_ref)
    saved_id = await repo.save_outbound(out, account_id, conv.inbox_id, result.channel_message_id)

    if not result.ok:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"No se pudo enviar: {result.error_message}"
        )

    return MessageResponse(
        id=saved_id,
        sender_type=SenderType.AGENT.value,
        sender_id=membership.user_id,
        type="text",
        content=body.text,
        created_at=datetime.now(timezone.utc),
    )


@router.get("/contacts", response_model=list[ContactResponse])
async def list_contacts(
    account_id: UUID,
    limit: int = 50,
    offset: int = 0,
    membership: Membership = Depends(require_role()),
) -> list[ContactResponse]:
    rows = await repo.get_contacts_for_account(account_id, limit, offset)
    return [
        ContactResponse(id=r["id"], external_id=r["external_id"], name=r["name"], phone=r["phone"])
        for r in rows
    ]


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    account_id: UUID, membership: Membership = Depends(require_role())
) -> StatsResponse:
    counts = await repo.get_conversation_stats(account_id)
    return StatsResponse(**counts)

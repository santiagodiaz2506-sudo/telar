"""
Acceso a datos. SQL plano a propósito: en un proyecto que otros van a leer,
una query visible enseña más que un ORM que hay que aprender.
"""

from __future__ import annotations

from uuid import UUID

from psycopg.rows import dict_row

from telar.core.state import Conversation
from telar.core.types import (
    ContactRef,
    ConversationStatus,
    InboundMessage,
    OutboundMessage,
    SenderType,
)
from telar.db.pool import get_pool


async def resolve_inbox(phone_number_id: str) -> dict | None:
    """El phone_number_id del webhook es la llave de enrutamiento."""
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, account_id, bot_id, default_team_id "
            "FROM inboxes WHERE phone_number_id = %s",
            (phone_number_id,),
        )
        cur.row_factory = dict_row
        rows = await cur.fetchall()
    return rows[0] if rows else None


async def already_processed(inbox_id: UUID, channel_message_id: str) -> bool:
    """Meta reintenta el webhook. Sin esto el bot responde dos veces."""
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT 1 FROM messages WHERE inbox_id = %s AND channel_message_id = %s",
            (inbox_id, channel_message_id),
        )
        return await cur.fetchone() is not None


async def upsert_contact(account_id: UUID, contact: ContactRef) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO contacts (account_id, external_id, name, phone)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (account_id, external_id) DO UPDATE
              SET name = COALESCE(EXCLUDED.name, contacts.name)
            RETURNING id
            """,
            (account_id, contact.external_id, contact.name, contact.phone),
        )
        row = await cur.fetchone()
    return row[0]


async def get_or_create_conversation(
    account_id: UUID, inbox_id: UUID, contact_id: UUID, bot_id: UUID | None
) -> Conversation:
    """
    El índice parcial one_live_conversation garantiza que no haya dos
    conversaciones vivas para el mismo contacto, incluso con webhooks
    simultáneos.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT id, status, assignee_id, team_id, bot_id,
                   last_contact_message_at, resolved_at
            FROM conversations
            WHERE inbox_id = %s AND contact_id = %s AND status <> 'resolved'
            """,
            (inbox_id, contact_id),
        )
        row = await cur.fetchone()

        if row is None:
            cur = await conn.execute(
                """
                INSERT INTO conversations
                    (account_id, inbox_id, contact_id, status, bot_id)
                VALUES (%s, %s, %s, 'bot', %s)
                RETURNING id, status, assignee_id, team_id, bot_id,
                          last_contact_message_at, resolved_at
                """,
                (account_id, inbox_id, contact_id, bot_id),
            )
            row = await cur.fetchone()

    return Conversation(
        id=row[0],
        account_id=account_id,
        inbox_id=inbox_id,
        contact_id=contact_id,
        status=ConversationStatus(row[1]),
        assignee_id=row[2],
        team_id=row[3],
        bot_id=row[4],
        last_contact_message_at=row[5],
        resolved_at=row[6],
    )


async def save_conversation(conv: Conversation) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            """
            UPDATE conversations
               SET status = %s, assignee_id = %s, team_id = %s,
                   last_contact_message_at = %s, resolved_at = %s
             WHERE id = %s
            """,
            (
                conv.status.value,
                conv.assignee_id,
                conv.team_id,
                conv.last_contact_message_at,
                conv.resolved_at,
                conv.id,
            ),
        )


async def save_inbound(msg: InboundMessage, conversation_id: UUID) -> UUID | None:
    """Devuelve None si el mensaje ya estaba guardado (webhook repetido)."""
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO messages
                (account_id, conversation_id, inbox_id, channel_message_id,
                 sender_type, type, content, media, delivery_status)
            VALUES (%s, %s, %s, %s, 'contact', %s, %s, %s, 'delivered')
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            (
                msg.account_id,
                conversation_id,
                msg.inbox_id,
                msg.channel_message_id,
                msg.type.value,
                msg.as_agent_text(),
                msg.media.model_dump_json() if msg.media else None,
            ),
        )
        row = await cur.fetchone()
    return row[0] if row else None


async def save_outbound(
    msg: OutboundMessage, account_id: UUID, inbox_id: UUID, channel_message_id: str | None
) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO messages
                (account_id, conversation_id, inbox_id, channel_message_id,
                 sender_type, sender_id, type, content, delivery_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                account_id,
                msg.conversation_id,
                inbox_id,
                channel_message_id,
                msg.sender_type.value if isinstance(msg.sender_type, SenderType) else msg.sender_type,
                msg.sender_id,
                msg.type.value,
                msg.text,
                "sent" if channel_message_id else "failed",
            ),
        )
        row = await cur.fetchone()
    return row[0]

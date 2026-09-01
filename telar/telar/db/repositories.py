"""
Acceso a datos. SQL plano a propósito: en un proyecto que otros van a leer,
una query visible enseña más que un ORM que hay que aprender.
"""

from __future__ import annotations

import json
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


def _to_vector_literal(embedding: list[float]) -> str:
    """
    psycopg no trae adaptador para el tipo vector de pgvector: se serializa
    a texto y se castea en la query con ::vector. repr() de un float en
    Python siempre usa punto decimal, sin importar el locale del sistema.
    """
    return "[" + ",".join(repr(x) for x in embedding) + "]"


async def insert_kb_chunks(
    knowledge_base_id: UUID, rows: list[tuple[str | None, str, list[float]]]
) -> None:
    """rows: (source, content, embedding)."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO kb_chunks (knowledge_base_id, source, content, embedding)
                VALUES (%s, %s, %s, %s::vector)
                """,
                [
                    (knowledge_base_id, source, content, _to_vector_literal(embedding))
                    for source, content, embedding in rows
                ],
            )


async def search_kb_chunks(
    account_id: UUID, embedding: list[float], limit: int = 5
) -> list[dict]:
    """
    Similitud coseno contra kb_chunks de todas las bases de conocimiento de
    la cuenta, usando el índice hnsw (kb_chunks_vec) de la migración.
    """
    vec = _to_vector_literal(embedding)
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT kc.content, kc.source,
                   1 - (kc.embedding <=> %(vec)s::vector) AS similarity
              FROM kb_chunks kc
              JOIN knowledge_bases kb ON kb.id = kc.knowledge_base_id
             WHERE kb.account_id = %(account_id)s
             ORDER BY kc.embedding <=> %(vec)s::vector
             LIMIT %(limit)s
            """,
            {"vec": vec, "account_id": account_id, "limit": limit},
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


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


async def get_user_by_email(email: str) -> dict | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, password_hash, is_superadmin "
            "FROM users WHERE email = %s",
            (email,),
        )
        cur.row_factory = dict_row
        rows = await cur.fetchall()
    return rows[0] if rows else None


async def get_user_by_id(user_id: UUID) -> dict | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, password_hash, is_superadmin "
            "FROM users WHERE id = %s",
            (user_id,),
        )
        cur.row_factory = dict_row
        rows = await cur.fetchall()
    return rows[0] if rows else None


async def get_user_accounts(user_id: UUID) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT account_id, role FROM account_users WHERE user_id = %s",
            (user_id,),
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


async def insert_user(
    email: str, name: str, password_hash: str, is_superadmin: bool = False
) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO users (email, name, password_hash, is_superadmin)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (email, name, password_hash, is_superadmin),
        )
        row = await cur.fetchone()
    return row[0]


async def get_tools_for_account(account_id: UUID) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, name, description, kind, config, schema, secret_config "
            "FROM tools WHERE account_id = %s AND enabled = true",
            (account_id,),
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


async def insert_tool(
    account_id: UUID,
    name: str,
    description: str,
    kind: str,
    config: dict,
    secret_config: bytes | None,
    schema: dict,
) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO tools (account_id, name, description, kind, config, secret_config, schema)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                account_id,
                name,
                description,
                kind,
                json.dumps(config),
                secret_config,
                json.dumps(schema),
            ),
        )
        row = await cur.fetchone()
    return row[0]


async def insert_account(name: str) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO accounts (name) VALUES (%s) RETURNING id", (name,)
        )
        row = await cur.fetchone()
    return row[0]


async def get_all_accounts() -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT id, name FROM accounts ORDER BY name")
        cur.row_factory = dict_row
        return await cur.fetchall()


async def get_accounts_for_user(user_id: UUID) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT a.id, a.name
              FROM accounts a
              JOIN account_users au ON au.account_id = a.id
             WHERE au.user_id = %s
             ORDER BY a.name
            """,
            (user_id,),
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


async def get_account_membership(account_id: UUID, user_id: UUID) -> dict | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT account_id, user_id, role FROM account_users "
            "WHERE account_id = %s AND user_id = %s",
            (account_id, user_id),
        )
        cur.row_factory = dict_row
        rows = await cur.fetchall()
    return rows[0] if rows else None


async def insert_account_membership(account_id: UUID, user_id: UUID, role: str) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO account_users (account_id, user_id, role)
            VALUES (%s, %s, %s)
            ON CONFLICT (account_id, user_id) DO UPDATE SET role = EXCLUDED.role
            """,
            (account_id, user_id, role),
        )


async def delete_account_membership(account_id: UUID, user_id: UUID) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            "DELETE FROM account_users WHERE account_id = %s AND user_id = %s",
            (account_id, user_id),
        )


async def get_account_members(account_id: UUID) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT u.id AS user_id, u.email, u.name, au.role
              FROM account_users au
              JOIN users u ON u.id = au.user_id
             WHERE au.account_id = %s
             ORDER BY u.name
            """,
            (account_id,),
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


async def insert_team(account_id: UUID, name: str) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO teams (account_id, name) VALUES (%s, %s) RETURNING id",
            (account_id, name),
        )
        row = await cur.fetchone()
    return row[0]


async def get_teams_for_account(account_id: UUID) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, name FROM teams WHERE account_id = %s ORDER BY name",
            (account_id,),
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


async def insert_team_member(team_id: UUID, user_id: UUID) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            "INSERT INTO team_members (team_id, user_id) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING",
            (team_id, user_id),
        )


async def delete_team_member(team_id: UUID, user_id: UUID) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            "DELETE FROM team_members WHERE team_id = %s AND user_id = %s",
            (team_id, user_id),
        )


async def get_conversation(conversation_id: UUID) -> Conversation | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT id, account_id, inbox_id, contact_id, status, assignee_id,
                   team_id, bot_id, last_contact_message_at, resolved_at
              FROM conversations
             WHERE id = %s
            """,
            (conversation_id,),
        )
        row = await cur.fetchone()

    if row is None:
        return None

    return Conversation(
        id=row[0],
        account_id=row[1],
        inbox_id=row[2],
        contact_id=row[3],
        status=ConversationStatus(row[4]),
        assignee_id=row[5],
        team_id=row[6],
        bot_id=row[7],
        last_contact_message_at=row[8],
        resolved_at=row[9],
    )


async def get_conversations_for_account(
    account_id: UUID, status: str | None = None, limit: int = 50, offset: int = 0
) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT c.id, c.status, c.assignee_id, c.last_contact_message_at,
                   ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone
              FROM conversations c
              JOIN contacts ct ON ct.id = c.contact_id
             WHERE c.account_id = %(account_id)s
               AND (%(status)s::text IS NULL OR c.status = %(status)s::conversation_status)
             ORDER BY c.last_contact_message_at DESC NULLS LAST
             LIMIT %(limit)s OFFSET %(offset)s
            """,
            {"account_id": account_id, "status": status, "limit": limit, "offset": offset},
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


async def get_messages_for_conversation(conversation_id: UUID, limit: int = 50) -> list[dict]:
    """Últimos N mensajes, devueltos en orden cronológico ascendente."""
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT id, sender_type, sender_id, type, content, delivery_status, created_at
              FROM messages
             WHERE conversation_id = %s
             ORDER BY created_at DESC
             LIMIT %s
            """,
            (conversation_id, limit),
        )
        cur.row_factory = dict_row
        rows = await cur.fetchall()
    return list(reversed(rows))


async def get_contacts_for_account(
    account_id: UUID, limit: int = 50, offset: int = 0
) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT id, external_id, name, phone, email, created_at
              FROM contacts
             WHERE account_id = %s
             ORDER BY created_at DESC
             LIMIT %s OFFSET %s
            """,
            (account_id, limit, offset),
        )
        cur.row_factory = dict_row
        return await cur.fetchall()


async def get_contact(contact_id: UUID) -> dict | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, external_id, name, phone FROM contacts WHERE id = %s",
            (contact_id,),
        )
        cur.row_factory = dict_row
        rows = await cur.fetchall()
    return rows[0] if rows else None


async def get_conversation_stats(account_id: UUID) -> dict[str, int]:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT status, count(*) FROM conversations WHERE account_id = %s GROUP BY status",
            (account_id,),
        )
        rows = await cur.fetchall()

    counts = {status.value: 0 for status in ConversationStatus}
    for status_value, count in rows:
        counts[status_value] = count
    return counts


async def get_bot_by_name(account_id: UUID, name: str) -> dict | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, name, active_version_id FROM bots WHERE account_id = %s AND name = %s",
            (account_id, name),
        )
        cur.row_factory = dict_row
        rows = await cur.fetchall()
    return rows[0] if rows else None


async def insert_bot(account_id: UUID, name: str) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO bots (account_id, name) VALUES (%s, %s) RETURNING id",
            (account_id, name),
        )
        row = await cur.fetchone()
    return row[0]


async def get_next_bot_version(bot_id: UUID) -> int:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM bot_versions WHERE bot_id = %s",
            (bot_id,),
        )
        row = await cur.fetchone()
    return row[0]


async def insert_bot_version(
    bot_id: UUID, version: int, graph: dict, notes: str | None = None
) -> UUID:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO bot_versions (bot_id, version, graph, notes)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (bot_id, version, json.dumps(graph), notes),
        )
        row = await cur.fetchone()
    return row[0]


async def set_active_bot_version(bot_id: UUID, version_id: UUID) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            "UPDATE bots SET active_version_id = %s WHERE id = %s",
            (version_id, bot_id),
        )


async def get_active_bot_graph(account_id: UUID) -> dict | None:
    """None si la cuenta no tiene bot, o si lo tiene sin versión activa."""
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT bv.graph
              FROM bots b
              JOIN bot_versions bv ON bv.id = b.active_version_id
             WHERE b.account_id = %s
            """,
            (account_id,),
        )
        rows = await cur.fetchall()
    return rows[0][0] if rows else None

"""
Adaptador de WhatsApp Cloud API.

Es el único archivo del proyecto que conoce el formato de Meta. Todo lo que
sale de aquí es InboundMessage; todo lo que entra es OutboundMessage.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx

from telar.config import settings
from telar.core.types import (
    Channel,
    ChannelAdapter,
    ContactRef,
    InboundMessage,
    Location,
    MediaRef,
    MessageType,
    OutboundMessage,
    SendResult,
)

log = logging.getLogger(__name__)

_MEDIA_TYPES = {"image", "audio", "video", "document", "sticker"}


class MetaWhatsAppAdapter(ChannelAdapter):
    channel = Channel.WHATSAPP

    def __init__(
        self,
        access_token: str,
        phone_number_id: str,
        app_secret: str,
        verify_token: str,
        api_version: str = "v21.0",
    ) -> None:
        self.access_token = access_token
        self.phone_number_id = phone_number_id
        self.app_secret = app_secret
        self.verify_token = verify_token
        self.base = f"https://graph.facebook.com/{api_version}"

    # ---------------------------------------------------------------- entrada

    def verify_webhook(self, params: dict[str, str]) -> str | None:
        if (
            params.get("hub.mode") == "subscribe"
            and params.get("hub.verify_token") == self.verify_token
        ):
            return params.get("hub.challenge")
        return None

    def verify_signature(self, raw_body: bytes, signature_header: str | None) -> bool:
        """
        Sin esta validación tu endpoint es público y cualquiera puede hacer
        hablar a tu bot. No la desactives ni en desarrollo.
        """
        if not signature_header or not signature_header.startswith("sha256="):
            return False
        expected = hmac.new(
            self.app_secret.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header[7:])

    def parse(
        self, payload: dict[str, Any], *, account_id: UUID, inbox_id: UUID
    ) -> list[InboundMessage]:
        out: list[InboundMessage] = []

        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})

                # Los webhooks de estado (sent/delivered/read) no son mensajes.
                if "messages" not in value:
                    continue

                profiles = {
                    c.get("wa_id"): c.get("profile", {}).get("name")
                    for c in value.get("contacts", [])
                }

                for raw in value["messages"]:
                    msg = self._parse_one(raw, profiles, account_id, inbox_id)
                    if msg:
                        out.append(msg)
        return out

    def _parse_one(
        self,
        raw: dict[str, Any],
        profiles: dict[str, str],
        account_id: UUID,
        inbox_id: UUID,
    ) -> InboundMessage | None:
        wa_id = raw.get("from")
        if not wa_id:
            return None

        kind = raw.get("type", "unsupported")
        contact = ContactRef(
            external_id=wa_id, name=profiles.get(wa_id), phone=f"+{wa_id}"
        )

        common = {
            "channel_message_id": raw["id"],
            "account_id": account_id,
            "inbox_id": inbox_id,
            "contact": contact,
            "sent_at": datetime.fromtimestamp(int(raw["timestamp"]), tz=timezone.utc),
            "reply_to_channel_message_id": raw.get("context", {}).get("id"),
            "raw": raw,
        }

        if kind == "text":
            return InboundMessage(
                **common, type=MessageType.TEXT, text=raw["text"]["body"]
            )

        if kind == "interactive":
            interactive = raw["interactive"]
            reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
            return InboundMessage(
                **common,
                type=MessageType.INTERACTIVE,
                text=reply.get("title"),
                interactive_reply_id=reply.get("id"),
            )

        if kind == "button":
            return InboundMessage(
                **common,
                type=MessageType.INTERACTIVE,
                text=raw["button"].get("text"),
                interactive_reply_id=raw["button"].get("payload"),
            )

        if kind == "location":
            loc = raw["location"]
            return InboundMessage(
                **common,
                type=MessageType.LOCATION,
                location=Location(
                    latitude=loc["latitude"],
                    longitude=loc["longitude"],
                    name=loc.get("name"),
                    address=loc.get("address"),
                ),
            )

        if kind in _MEDIA_TYPES:
            node = raw[kind]
            return InboundMessage(
                **common,
                type=MessageType(kind) if kind != "sticker" else MessageType.IMAGE,
                media=MediaRef(
                    external_id=node.get("id"),
                    mime_type=node.get("mime_type"),
                    sha256=node.get("sha256"),
                    filename=node.get("filename"),
                    caption=node.get("caption"),
                ),
            )

        log.info("tipo de mensaje no soportado: %s", kind)
        return InboundMessage(**common, type=MessageType.UNSUPPORTED)

    # ---------------------------------------------------------------- salida

    async def send(self, message: OutboundMessage, to: ContactRef) -> SendResult:
        body = self._build_body(message, to)
        url = f"{self.base}/{self.phone_number_id}/messages"

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                url,
                json=body,
                headers={"Authorization": f"Bearer {self.access_token}"},
            )

        if resp.status_code >= 400:
            err = resp.json().get("error", {})
            code = str(err.get("code", resp.status_code))
            log.warning("envío falló %s: %s", code, err.get("message"))
            return SendResult(
                ok=False,
                error_code=code,
                error_message=err.get("message"),
                # 131047 y 131026 no se reintentan: son reglas de negocio.
                retryable=resp.status_code >= 500 or resp.status_code == 429,
            )

        data = resp.json()
        return SendResult(
            ok=True, channel_message_id=data["messages"][0]["id"], status="sent"
        )

    def _build_body(self, message: OutboundMessage, to: ContactRef) -> dict[str, Any]:
        body: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.external_id,
        }

        if message.template:
            body["type"] = "template"
            body["template"] = {
                "name": message.template.name,
                "language": {"code": message.template.language},
                "components": message.template.components,
            }
            return body

        if message.quick_replies:
            body["type"] = "interactive"
            body["interactive"] = {
                "type": "button",
                "body": {"text": message.text or ""},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": q.id, "title": q.title[:20]}}
                        for q in message.quick_replies[:3]
                    ]
                },
            }
            return body

        body["type"] = "text"
        body["text"] = {"body": message.text or "", "preview_url": False}
        if message.reply_to_channel_message_id:
            body["context"] = {"message_id": message.reply_to_channel_message_id}
        return body

    async def mark_read(self, channel_message_id: str) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{self.base}/{self.phone_number_id}/messages",
                json={
                    "messaging_product": "whatsapp",
                    "status": "read",
                    "message_id": channel_message_id,
                },
                headers={"Authorization": f"Bearer {self.access_token}"},
            )

    async def download_media(self, media: MediaRef) -> MediaRef:
        """
        La URL que devuelve Meta expira en minutos. Descarga apenas llegue
        el mensaje, no cuando el agente lo necesite.
        """
        headers = {"Authorization": f"Bearer {self.access_token}"}
        async with httpx.AsyncClient(timeout=30) as client:
            meta = await client.get(f"{self.base}/{media.external_id}", headers=headers)
            meta.raise_for_status()
            info = meta.json()
            binary = await client.get(info["url"], headers=headers)
            binary.raise_for_status()

        media.mime_type = info.get("mime_type", media.mime_type)
        media.size_bytes = len(binary.content)
        # v0: sin almacenamiento externo todavía. Aquí va S3/MinIO después.
        return media


def default_adapter() -> MetaWhatsAppAdapter:
    s = settings()
    return MetaWhatsAppAdapter(
        access_token=s.meta_access_token,
        phone_number_id=s.meta_phone_number_id,
        app_secret=s.meta_app_secret,
        verify_token=s.meta_verify_token,
        api_version=s.meta_api_version,
    )

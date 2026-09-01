"""Aplicación FastAPI. El webhook valida, deduplica y encola. Nada más."""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, Response

from telar.channels.meta import default_adapter
from telar.config import settings
from telar.db import repositories as repo
from telar.db.pool import close_pool, get_pool
from telar.worker.dispatcher import Dispatcher
from telar.worker.pipeline import Pipeline

logging.basicConfig(level=settings().log_level)
log = logging.getLogger("telar")

adapter = default_adapter()
pipeline = Pipeline(adapter)
dispatcher = Dispatcher(pipeline.handle)

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/webhooks/whatsapp")
async def verify(request: Request) -> Response:
    challenge = adapter.verify_webhook(dict(request.query_params))
    if challenge is None:
        return Response(status_code=403)
    return Response(content=challenge, media_type="text/plain")


@router.post("/webhooks/whatsapp")
async def inbound(request: Request) -> dict[str, str]:
    """
    Devuelve 200 siempre y de inmediato. Si tardas, Meta reintenta y acabas
    procesando el mismo mensaje varias veces.
    """
    raw = await request.body()

    if not adapter.verify_signature(raw, request.headers.get("X-Hub-Signature-256")):
        log.warning("firma inválida, payload descartado")
        return {"status": "ignored"}

    payload = json.loads(raw)
    phone_number_id = _phone_number_id(payload)
    if not phone_number_id:
        return {"status": "ok"}

    inbox = await repo.resolve_inbox(phone_number_id)
    if inbox is None:
        log.warning("phone_number_id %s sin inbox configurado", phone_number_id)
        return {"status": "ok"}

    messages = adapter.parse(
        payload, account_id=inbox["account_id"], inbox_id=inbox["id"]
    )

    for msg in messages:
        if await repo.already_processed(msg.inbox_id, msg.channel_message_id):
            continue
        dispatcher.submit(msg)

    return {"status": "ok"}


def _phone_number_id(payload: dict) -> str | None:
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            meta = change.get("value", {}).get("metadata", {})
            if meta.get("phone_number_id"):
                return meta["phone_number_id"]
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    log.info("telar listo")
    yield
    await dispatcher.drain()
    await close_pool()


app = FastAPI(title="Telar", version="0.1.0", lifespan=lifespan)
app.include_router(router)

"""Dependencia de FastAPI para proteger endpoints con el token de sesión."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from telar.auth.security import decode_access_token
from telar.db import repositories as repo

_bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No autenticado",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    Busca al usuario fresco en la base de datos en cada request, no solo lo
    que dice el token: así un usuario borrado queda bloqueado de inmediato,
    no recién cuando expire el token.
    """
    if credentials is None:
        raise _UNAUTHORIZED

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise _UNAUTHORIZED

    user = await repo.get_user_by_id(user_id)
    if user is None:
        raise _UNAUTHORIZED

    return user

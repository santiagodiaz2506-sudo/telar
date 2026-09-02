"""
Endpoints de cuentas, membresía y equipos.

administrator gestiona quién pertenece a la cuenta y qué equipos existen;
supervisor puede mover gente dentro/fuera de un equipo pero no dar de
alta/baja en la cuenta ni crear equipos; agent no gestiona nada de esto.
"""

from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from telar.auth.dependencies import Membership, get_current_user, require_role
from telar.auth.roles import AccountRole
from telar.auth.security import hash_password
from telar.db import repositories as repo

router = APIRouter(prefix="/accounts", tags=["accounts"])


class CreateAccountRequest(BaseModel):
    name: str


class AccountResponse(BaseModel):
    id: UUID
    name: str


class AddMemberRequest(BaseModel):
    email: str
    role: AccountRole
    name: str | None = None  # requerido solo si el email todavía no tiene usuario


class MemberResponse(BaseModel):
    user_id: UUID
    email: str
    name: str
    role: str
    temporary_password: str | None = None  # presente una sola vez: se creó el usuario ahora


class CreateTeamRequest(BaseModel):
    name: str


class TeamResponse(BaseModel):
    id: UUID
    name: str


class TeamMemberRequest(BaseModel):
    user_id: UUID


class TeamMemberResponse(BaseModel):
    user_id: UUID
    email: str
    name: str


@router.post("", response_model=AccountResponse)
async def create_account(
    body: CreateAccountRequest, user: dict = Depends(get_current_user)
) -> AccountResponse:
    if not user["is_superadmin"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo un superadmin puede crear cuentas")

    account_id = await repo.insert_account(body.name)
    # Sin esto, la cuenta queda sin ningún administrator real -- solo
    # accesible por el bypass de superadmin. Quien la crea queda como su
    # primer administrador, igual que pasaría si se sumara a sí mismo desde
    # Equipo después.
    await repo.insert_account_membership(account_id, user["id"], AccountRole.ADMINISTRATOR.value)
    return AccountResponse(id=account_id, name=body.name)


@router.get("", response_model=list[AccountResponse])
async def list_accounts(user: dict = Depends(get_current_user)) -> list[AccountResponse]:
    if user["is_superadmin"]:
        rows = await repo.get_all_accounts()
    else:
        rows = await repo.get_accounts_for_user(user["id"])
    return [AccountResponse(**row) for row in rows]


@router.post("/{account_id}/members", response_model=MemberResponse)
async def add_member(
    account_id: UUID,
    body: AddMemberRequest,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> MemberResponse:
    target = await repo.get_user_by_email(body.email)
    temporary_password: str | None = None

    if target is None:
        # No hay infraestructura de invitación por email en el proyecto: se
        # crea el usuario acá mismo con una contraseña temporal que el
        # administrador comparte fuera de banda. El usuario la cambia con
        # POST /auth/change-password en su primer login.
        if not body.name:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "No existe un usuario con ese email. Mandá 'name' para crearlo de una.",
            )
        temporary_password = secrets.token_urlsafe(12)
        user_id = await repo.insert_user(body.email, body.name, hash_password(temporary_password))
        target = {"id": user_id, "email": body.email, "name": body.name}

    await repo.insert_account_membership(account_id, target["id"], body.role.value)
    return MemberResponse(
        user_id=target["id"],
        email=target["email"],
        name=target["name"],
        role=body.role.value,
        temporary_password=temporary_password,
    )


@router.get("/{account_id}/members", response_model=list[MemberResponse])
async def list_members(
    account_id: UUID, membership: Membership = Depends(require_role())
) -> list[MemberResponse]:
    rows = await repo.get_account_members(account_id)
    return [MemberResponse(**row) for row in rows]


@router.delete("/{account_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    account_id: UUID,
    user_id: UUID,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> None:
    await repo.delete_account_membership(account_id, user_id)


@router.post("/{account_id}/teams", response_model=TeamResponse)
async def create_team(
    account_id: UUID,
    body: CreateTeamRequest,
    membership: Membership = Depends(require_role(AccountRole.ADMINISTRATOR)),
) -> TeamResponse:
    team_id = await repo.insert_team(account_id, body.name)
    return TeamResponse(id=team_id, name=body.name)


@router.get("/{account_id}/teams", response_model=list[TeamResponse])
async def list_teams(
    account_id: UUID, membership: Membership = Depends(require_role())
) -> list[TeamResponse]:
    rows = await repo.get_teams_for_account(account_id)
    return [TeamResponse(**row) for row in rows]


@router.get("/{account_id}/teams/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_team_members(
    account_id: UUID, team_id: UUID, membership: Membership = Depends(require_role())
) -> list[TeamMemberResponse]:
    rows = await repo.get_team_members(team_id)
    return [TeamMemberResponse(**row) for row in rows]


@router.post("/{account_id}/teams/{team_id}/members", status_code=status.HTTP_204_NO_CONTENT)
async def add_team_member(
    account_id: UUID,
    team_id: UUID,
    body: TeamMemberRequest,
    membership: Membership = Depends(
        require_role(AccountRole.ADMINISTRATOR, AccountRole.SUPERVISOR)
    ),
) -> None:
    await repo.insert_team_member(team_id, body.user_id)


@router.delete(
    "/{account_id}/teams/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_member(
    account_id: UUID,
    team_id: UUID,
    user_id: UUID,
    membership: Membership = Depends(
        require_role(AccountRole.ADMINISTRATOR, AccountRole.SUPERVISOR)
    ),
) -> None:
    await repo.delete_team_member(team_id, user_id)

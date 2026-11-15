"""Inventario persistente del jugador (sombrero, arma de la mano y mochila)."""
from fastapi import Depends, HTTPException, Request, status, APIRouter
from app.application.use_cases import GetInventoryUseCase, SaveInventoryUseCase
from app.domain.entities.inventory import PlayerInventory, WeaponStack
from app.domain.entities.session import UserSession
from app.domain.exceptions import InvalidCredentialsError, TamperDetectedError, ValidationError
from app.presentation.dependencies import (
    get_client_ip,
    get_current_session,
    get_grant_ledger,
    get_inventory_repository,
    get_repositories,
    get_user_agent,
    require_csrf_protection,
)
from app.presentation.schemas import InventoryPayload, WeaponStackPayload

router = APIRouter()


def _inventory_payload(inv: PlayerInventory) -> InventoryPayload:
    def stack(item: WeaponStack | None) -> WeaponStackPayload | None:
        return WeaponStackPayload(arma=item.arma, municion=item.municion) if item else None

    return InventoryPayload(
        sombrero=inv.hat_state,
        enMano=stack(inv.equipped),
        mochila=[stack(i) for i in inv.backpack],
    )


@router.get("/inventory", response_model=InventoryPayload, tags=["Inventory"])
def get_inventory(
    session: UserSession = Depends(get_current_session),
    repos=Depends(get_repositories),
    inventory_repo=Depends(get_inventory_repository),
) -> InventoryPayload:
    user_repo, _, _, _ = repos
    try:
        inv = GetInventoryUseCase(user_repo, inventory_repo).execute(session.username)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return _inventory_payload(inv)


@router.put("/inventory", response_model=InventoryPayload, tags=["Inventory"])
def save_inventory(
    body: InventoryPayload,
    request: Request,
    session: UserSession = Depends(require_csrf_protection),
    repos=Depends(get_repositories),
    inventory_repo=Depends(get_inventory_repository),
    ledger=Depends(get_grant_ledger),
) -> InventoryPayload:
    user_repo, _, _, audit_repo = repos
    uc = SaveInventoryUseCase(user_repo, inventory_repo, audit_repo, ledger)
    try:
        inv = uc.execute(
            username=session.username,
            hat_state=body.sombrero,
            equipped=WeaponStack(body.enMano.arma, body.enMano.municion) if body.enMano else None,
            backpack=[WeaponStack(i.arma, i.municion) for i in body.mochila],
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except TamperDetectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return _inventory_payload(inv)

"""Suministros del mapa: el servidor decide que aparece, cuando y cuanto dura; el cliente solo lo dibuja."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.application.supply_registry import GrantLedger, SupplyRunRegistry
from app.application.use_cases import ClaimSupplyUseCase, GetSupplyRunUseCase, StartSupplyRunUseCase
from app.domain.entities.session import UserSession
from app.domain.supplies import SupplyUnavailableError
from app.presentation.dependencies import (
    get_grant_ledger,
    get_optional_session,
    get_repositories,
    get_supply_registry,
)
from app.presentation.schemas import SupplyClaimRequest, SupplyRewardPayload, SupplyRunPayload

router = APIRouter()


@router.post(
    "/supplies/runs", response_model=SupplyRunPayload, status_code=status.HTTP_201_CREATED, tags=["Supplies"]
)
def start_supply_run(registry: SupplyRunRegistry = Depends(get_supply_registry)) -> dict:
    return StartSupplyRunUseCase(registry).execute()


@router.get("/supplies/runs/{run_id}", response_model=SupplyRunPayload, tags=["Supplies"])
def get_supply_run(run_id: str, registry: SupplyRunRegistry = Depends(get_supply_registry)) -> dict:
    try:
        return GetSupplyRunUseCase(registry).execute(run_id)
    except SupplyUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/supplies/runs/{run_id}/claim", response_model=SupplyRewardPayload, tags=["Supplies"])
def claim_supply(
    run_id: str,
    body: SupplyClaimRequest,
    session: UserSession | None = Depends(get_optional_session),
    registry: SupplyRunRegistry = Depends(get_supply_registry),
    ledger: GrantLedger = Depends(get_grant_ledger),
) -> dict:
    try:
        return ClaimSupplyUseCase(registry, ledger).execute(run_id, body.item, session.user_id if session else None)
    except SupplyUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

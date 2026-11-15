"""Progreso del jugador con reglas anti-trampa."""
from fastapi import Depends, HTTPException, Request, status, APIRouter
from app.application.use_cases import GetProgressUseCase, UpdateProgressUseCase
from app.domain.entities.session import UserSession
from app.domain.exceptions import TamperDetectedError, ValidationError
from app.presentation.dependencies import (
    get_client_ip,
    get_current_session,
    get_repositories,
    get_user_agent,
    require_csrf_protection,
)
from app.presentation.schemas import ProgressPayload, ProgressUpdateRequest

router = APIRouter()


@router.get("/progress", response_model=ProgressPayload, tags=["Progress & Anti-Cheat"])
def get_progress(
    request: Request,
    session: UserSession = Depends(get_current_session),
    repos=Depends(get_repositories),
) -> ProgressPayload:
    user_repo, progress_repo, _, audit_repo = repos
    uc = GetProgressUseCase(user_repo, progress_repo, audit_repo)
    dto = uc.execute(
        username=session.username,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return ProgressPayload(
        nivel=dto.nivel,
        mejorTiempo=dto.mejor_tiempo,
        victorias=dto.victorias,
    )


@router.put("/progress", response_model=ProgressPayload, tags=["Progress & Anti-Cheat"])
def update_progress(
    body: ProgressUpdateRequest,
    request: Request,
    session: UserSession = Depends(require_csrf_protection),
    repos=Depends(get_repositories),
) -> ProgressPayload:
    user_repo, progress_repo, _, audit_repo = repos
    uc = UpdateProgressUseCase(user_repo, progress_repo, audit_repo)
    try:
        dto = uc.execute(
            username=session.username,
            requested_level=body.nivel,
            victory_seconds=body.tiempoVictoria,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except TamperDetectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return ProgressPayload(
        nivel=dto.nivel,
        mejorTiempo=dto.mejor_tiempo,
        victorias=dto.victorias,
    )

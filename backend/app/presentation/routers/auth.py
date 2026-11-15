"""Registro, inicio y cierre de sesion; datos de la sesion actual."""
from fastapi import Cookie, Depends, HTTPException, Request, Response, status, APIRouter
from app.application.use_cases import (
    AuthenticateUserUseCase,
    GetProgressUseCase,
    RegisterUserUseCase,
    RevokeSessionUseCase,
)
from app.core.config import settings
from app.domain.entities.session import UserSession
from app.domain.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    UserAlreadyExistsError,
    ValidationError,
)
from app.presentation.dependencies import (
    get_client_ip,
    get_current_session,
    get_repositories,
    get_user_agent,
    require_csrf_protection,
)
from app.presentation.schemas import AuthSuccessResponse, CredentialsRequest, ProgressPayload

router = APIRouter()


def _set_auth_cookies(response: Response, opaque_token: str, csrf_token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=opaque_token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=settings.session_ttl_seconds,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    response.headers["X-CSRF-Token"] = csrf_token


@router.post(
    "/auth/register",
    response_model=AuthSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["IAM & Auth"],
)
def register_user(
    body: CredentialsRequest,
    request: Request,
    response: Response,
    repos=Depends(get_repositories),
) -> AuthSuccessResponse:
    user_repo, progress_repo, session_repo, audit_repo = repos
    uc = RegisterUserUseCase(user_repo, progress_repo, session_repo, audit_repo)
    try:
        result = uc.execute(
            display_name=body.nombre,
            password=body.clave,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    _set_auth_cookies(response, result.opaque_session_token, result.csrf_token)
    return AuthSuccessResponse(
        nombre=result.display_name,
        csrfToken=result.csrf_token,
        progreso=ProgressPayload(
            nivel=result.progreso.nivel,
            mejorTiempo=result.progreso.mejor_tiempo,
            victorias=result.progreso.victorias,
        ),
    )


@router.post("/auth/login", response_model=AuthSuccessResponse, tags=["IAM & Auth"])
def login_user(
    body: CredentialsRequest,
    request: Request,
    response: Response,
    repos=Depends(get_repositories),
) -> AuthSuccessResponse:
    user_repo, progress_repo, session_repo, audit_repo = repos
    uc = AuthenticateUserUseCase(user_repo, progress_repo, session_repo, audit_repo)
    try:
        result = uc.execute(
            display_name=body.nombre,
            password=body.clave,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except AccountLockedError as exc:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(exc),
            headers={"Retry-After": str(exc.remaining_seconds)},
        ) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    _set_auth_cookies(response, result.opaque_session_token, result.csrf_token)
    return AuthSuccessResponse(
        nombre=result.display_name,
        csrfToken=result.csrf_token,
        progreso=ProgressPayload(
            nivel=result.progreso.nivel,
            mejorTiempo=result.progreso.mejor_tiempo,
            victorias=result.progreso.victorias,
        ),
        aviso=result.progreso.aviso,
    )


@router.post("/auth/logout", tags=["IAM & Auth"])
def logout_user(
    request: Request,
    response: Response,
    ideolo_session: str | None = Cookie(default=None, alias=settings.session_cookie_name),
    _session: UserSession = Depends(require_csrf_protection),
    repos=Depends(get_repositories),
) -> dict[str, bool]:
    _, _, session_repo, audit_repo = repos
    uc = RevokeSessionUseCase(session_repo, audit_repo)
    uc.execute(
        raw_token=ideolo_session,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    response.delete_cookie(key=settings.session_cookie_name, path="/", samesite="strict")
    response.delete_cookie(key=settings.csrf_cookie_name, path="/", samesite="strict")
    return {"ok": True}


@router.get("/auth/me", response_model=AuthSuccessResponse, tags=["IAM & Auth"])
def current_user_info(
    request: Request,
    response: Response,
    session: UserSession = Depends(get_current_session),
    repos=Depends(get_repositories),
) -> AuthSuccessResponse:
    user_repo, progress_repo, _, audit_repo = repos
    uc = GetProgressUseCase(user_repo, progress_repo, audit_repo)
    try:
        progreso = uc.execute(
            username=session.username,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    response.headers["X-CSRF-Token"] = session.csrf_token
    return AuthSuccessResponse(
        nombre=session.display_name,
        csrfToken=session.csrf_token,
        progreso=ProgressPayload(
            nivel=progreso.nivel,
            mejorTiempo=progreso.mejor_tiempo,
            victorias=progreso.victorias,
        ),
        aviso=progreso.aviso,
    )

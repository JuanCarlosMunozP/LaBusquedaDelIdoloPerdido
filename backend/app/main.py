from collections import defaultdict, deque
from contextlib import asynccontextmanager
import time
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.origin import origen_permitido
from app.infrastructure.session import init_db
from app.presentation.dependencies import get_client_ip
from app.presentation.routers import api_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "API de Identidad (IAM), Persistencia Firmada (HMAC-SHA256) y Auditoría Forense "
        "con Arquitectura Limpia para La Búsqueda del Ídolo Perdido."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Ventanas deslizantes en memoria para Rate Limiting defensivo en capa de aplicación
_ip_windows: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_limiter() -> None:
    _ip_windows.clear()


def _excede_limite(clave: str, limite: int, ventana: float, ahora: float) -> bool:
    """True si ya se alcanzo `limite` peticiones en los ultimos `ventana` segundos; si no, anota esta."""
    registro = _ip_windows[clave]
    while registro and (ahora - registro[0]) > ventana:
        registro.popleft()
    if len(registro) >= limite:
        return True
    registro.append(ahora)
    return False


def _rechazo(codigo: int, detalle: str, cabeceras: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=codigo, content={"detail": detalle}, headers=cabeceras)


@app.middleware("http")
async def security_hardening_and_rate_limit_middleware(request: Request, call_next):
    now = time.monotonic()
    client_ip = get_client_ip(request)
    path = request.url.path
    is_auth_route = path.startswith("/api/v1/auth/login") or path.startswith("/api/v1/auth/register")

    # 1) Origen: las peticiones que modifican datos deben venir de esta misma web
    if path.startswith("/api/") and not origen_permitido(request.method, request.headers, settings):
        return _rechazo(status.HTTP_403_FORBIDDEN, "Origen de la petición no permitido.")

    # 2) Limite general por IP (mas estricto en login y registro)
    limit = settings.auth_rate_limit_per_minute if is_auth_route else settings.rate_limit_per_minute
    if _excede_limite(f"{client_ip}:{'auth' if is_auth_route else 'general'}", limit, 60.0, now):
        return _rechazo(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Límite de peticiones por minuto excedido (Rate Limit activo).",
            {"Retry-After": "60"},
        )

    # 3) Escrituras de progreso e inventario: limite por IP y por sesion (frena scripts desde la consola)
    if request.method == "PUT" and path.rstrip("/") in ("/api/v1/progress", "/api/v1/inventory"):
        token = request.cookies.get(settings.session_cookie_name) or request.headers.get("authorization", "")
        claves = [f"{client_ip}:escritura"]
        if token:
            claves.append(f"sesion:{hash(token)}:escritura")
        if any(_excede_limite(c, settings.write_rate_limit_per_minute, 60.0, now) for c in claves):
            return _rechazo(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Demasiados guardados seguidos: espera un momento.",
                {"Retry-After": "60"},
            )

    # 4) Cuentas nuevas: pocas por IP y hora
    if request.method == "POST" and path.rstrip("/") == "/api/v1/auth/register":
        if _excede_limite(f"{client_ip}:registro", settings.register_rate_limit_per_hour, 3600.0, now):
            return _rechazo(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Demasiados registros desde esta conexión: inténtalo más tarde.",
                {"Retry-After": "3600"},
            )

    response = await call_next(request)

    # Cabeceras defensivas HTTP (SEG-006)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(api_router)

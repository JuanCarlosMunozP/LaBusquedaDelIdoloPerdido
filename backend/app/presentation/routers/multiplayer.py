"""Multijugador en tiempo real: crear sala (HTTP) y jugar en ella (WebSocket). Solo con cuenta, sin invitados."""
import json
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status

from app.core.config import settings
from app.core.security import hash_session_token
from app.domain.entities.session import UserSession
from app.domain.multiplayer import MAX_PLAYERS, RoomError, RoomRegistry
from app.infrastructure.repositories import SqlSessionRepository
from app.presentation.dependencies import get_room_registry, get_session_factory, require_csrf_protection
from app.presentation.ws_hub import RoomHub

router = APIRouter()
hub = RoomHub()
MAX_MESSAGE_BYTES = 1024
CLOSE_POLICY = 1008          # politica violada (sin cuenta, origen raro, spam)
CLOSE_ROOM = 4404            # la sala no existe / esta llena


@router.post("/rooms", status_code=status.HTTP_201_CREATED, tags=["Multiplayer"])
def create_room(
    _session: UserSession = Depends(require_csrf_protection),
    registry: RoomRegistry = Depends(get_room_registry),
) -> dict:
    try:
        return {"codigo": registry.create_room(), "maxJugadores": MAX_PLAYERS}
    except RoomError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


def same_origin(origin: str | None, host: str | None) -> bool:
    """El navegador siempre manda Origin en un WebSocket: solo se acepta el de este mismo sitio."""
    if not origin or not host:
        return False
    return urlparse(origin).netloc.lower() == host.lower()


def _find_session(websocket: WebSocket, session_factory) -> UserSession | None:
    token = websocket.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    db = session_factory()
    try:
        session = SqlSessionRepository(db).get_by_token_hash(hash_session_token(token))
    finally:
        db.close()                                  # no se retiene la conexion de BD durante la partida
    return session if session is not None and session.is_active() else None


@router.websocket("/ws/rooms/{code}")
async def play_in_room(
    websocket: WebSocket,
    code: str,
    registry: RoomRegistry = Depends(get_room_registry),
    session_factory=Depends(get_session_factory),
) -> None:
    if not same_origin(websocket.headers.get("origin"), websocket.headers.get("host")):
        await websocket.close(code=CLOSE_POLICY)
        return
    session = _find_session(websocket, session_factory)
    if session is None:
        await websocket.close(code=CLOSE_POLICY)    # sin cuenta no se juega en linea
        return

    await websocket.accept()
    code = registry.normalize_code(code)
    try:
        player = registry.join(code, session.user_id, session.display_name)
    except RoomError as exc:
        await websocket.send_json({"t": "error", "mensaje": str(exc)})
        await websocket.close(code=CLOSE_ROOM)
        return

    previous = hub.add(code, session.user_id, websocket)
    if previous is not None:
        try:
            await previous.close(code=CLOSE_POLICY)      # la misma cuenta abrio otra pestaña
        except Exception:
            pass
    await websocket.send_json({
        "t": "sala", "codigo": code, "tuId": player.id, "max": MAX_PLAYERS, "jugadores": registry.snapshot(code),
    })
    await hub.broadcast(code, {"t": "entra", "jugador": player.public()}, skip=player.id)

    try:
        while True:
            texto = await websocket.receive_text()
            if len(texto) > MAX_MESSAGE_BYTES:
                await websocket.close(code=CLOSE_POLICY)
                return
            if not registry.allow_message(player.id):
                continue                                  # demasiados mensajes: se ignoran
            try:
                mensaje = json.loads(texto)
            except ValueError:
                continue
            if not isinstance(mensaje, dict) or mensaje.get("t") != "estado":
                continue
            estado, corregido = registry.apply_state(player.id, mensaje)
            if estado is None:
                continue
            if corregido:
                await websocket.send_json({"t": "corregir", "x": estado["x"], "y": estado["y"], "z": estado["z"]})
            await hub.broadcast(code, {"t": "estado", "jugador": estado}, skip=player.id)
    except WebSocketDisconnect:
        pass
    finally:
        if hub.remove(code, session.user_id, websocket):
            registry.leave(session.user_id)
            await hub.broadcast(code, {"t": "sale", "id": player.id})

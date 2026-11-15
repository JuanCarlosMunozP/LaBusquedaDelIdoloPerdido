"""Conexiones WebSocket abiertas por sala: reparte mensajes a los jugadores de una sala."""
from fastapi import WebSocket


class RoomHub:
    def __init__(self) -> None:
        self._sockets: dict[str, dict[str, WebSocket]] = {}      # sala -> {id de jugador: socket}

    def add(self, code: str, user_id: str, ws: WebSocket) -> WebSocket | None:
        """Registra el socket. Devuelve el anterior de esa cuenta (si abrio otra pestaña) para cerrarlo."""
        sockets = self._sockets.setdefault(code, {})
        old = sockets.get(user_id)
        sockets[user_id] = ws
        return old

    def remove(self, code: str, user_id: str, ws: WebSocket) -> bool:
        """Quita el socket solo si sigue siendo este (una pestaña nueva pudo haberlo reemplazado)."""
        sockets = self._sockets.get(code, {})
        if sockets.get(user_id) is not ws:
            return False
        del sockets[user_id]
        if not sockets:
            self._sockets.pop(code, None)
        return True

    async def broadcast(self, code: str, message: dict, skip: str | None = None) -> None:
        for user_id, ws in list(self._sockets.get(code, {}).items()):
            if user_id == skip:
                continue
            try:
                await ws.send_json(message)
            except Exception:       # un socket roto no debe frenar al resto
                pass

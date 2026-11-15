"""
Multijugador: salas con codigo, hasta 4 jugadores. Logica pura (sin FastAPI ni sockets), probada aparte.

El servidor es quien manda: decide quien entra a una sala, valida y limita todo lo que manda cada cliente
(posiciones imposibles, mensajes demasiado seguidos, textos raros) y es el unico que reparte el estado.
El cliente solo envia lo suyo y dibuja a los demas.

Las salas viven en memoria del proceso: con varios workers cada uno tendria las suyas (igual que los suministros).
"""
import math
import secrets
import time
from dataclasses import dataclass, field
from typing import Callable

from app.domain.game_rules import WEAPONS as _GAME_WEAPONS

MAX_PLAYERS = 4
MAX_ROOMS = 200
CODE_LENGTH = 5
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # sin 0/O, 1/I/L: se dicta por voz sin confundirse
MAX_COORD = 600.0                                    # el mapa mas grande cabe de sobra
MAX_SPEED = 45.0                                     # m/s: correr + margen; mas que eso es teletransporte
SPEED_SLACK = 3.0                                    # m de tolerancia por lag y saltos
MAX_MSG_PER_SECOND = 30.0
WEAPONS = frozenset(_GAME_WEAPONS) | {""}                 # las mismas armas que las reglas del juego


class RoomError(Exception):
    """Error de sala con mensaje apto para mostrar."""


class RoomNotFoundError(RoomError):
    pass


class RoomFullError(RoomError):
    pass


@dataclass
class PlayerState:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    ry: float = 0.0          # hacia donde mira (radianes)
    nadando: bool = False
    golpe: bool = False
    vida: int = 100
    arma: str = ""
    sombrero: bool = True
    nivel: int = 0           # bioma en el que esta: solo se ven entre si los que comparten nivel

    def to_dict(self) -> dict:
        return {
            "x": round(self.x, 2), "y": round(self.y, 2), "z": round(self.z, 2), "ry": round(self.ry, 3),
            "nadando": self.nadando, "golpe": self.golpe, "vida": self.vida, "arma": self.arma,
            "sombrero": self.sombrero, "nivel": self.nivel,
        }


@dataclass
class Player:
    id: str
    name: str
    state: PlayerState = field(default_factory=PlayerState)
    last_update: float = 0.0
    tokens: float = MAX_MSG_PER_SECOND
    last_refill: float = 0.0
    has_position: bool = False

    def public(self) -> dict:
        return {"id": self.id, "nombre": self.name, **self.state.to_dict()}


@dataclass
class Room:
    code: str
    players: dict[str, Player] = field(default_factory=dict)


def _number(value, limit: float) -> float | None:
    """Numero finito dentro de [-limit, limit] o None (bool no cuenta como numero)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value) or abs(value) > limit:
        return None
    return float(value)


class RoomRegistry:
    def __init__(self, clock: Callable[[], float] = time.monotonic, max_rooms: int = MAX_ROOMS) -> None:
        self._clock = clock
        self._max_rooms = max_rooms
        self._rooms: dict[str, Room] = {}
        self._room_of: dict[str, str] = {}      # id de jugador -> codigo de su sala

    # ---------------------------------------------------------------- salas
    def create_room(self) -> str:
        if len(self._rooms) >= self._max_rooms:
            raise RoomError("Hay demasiadas salas abiertas. Intenta de nuevo en unos minutos.")
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self._rooms:
                break
        self._rooms[code] = Room(code)
        return code

    @staticmethod
    def normalize_code(code: str) -> str:
        return (code or "").strip().upper()[:CODE_LENGTH]

    def room_of(self, user_id: str) -> str | None:
        return self._room_of.get(user_id)

    def snapshot(self, code: str) -> list[dict]:
        room = self._rooms.get(self.normalize_code(code))
        return [p.public() for p in room.players.values()] if room else []

    def room_count(self) -> int:
        return len(self._rooms)

    # ---------------------------------------------------------------- jugadores
    def join(self, code: str, user_id: str, name: str) -> Player:
        code = self.normalize_code(code)
        room = self._rooms.get(code)
        if room is None:
            raise RoomNotFoundError("Esa sala no existe o ya se cerró.")
        previous = self._room_of.get(user_id)
        if previous and previous != code:
            self.leave(user_id)                  # una cuenta solo puede estar en una sala a la vez
        if user_id not in room.players and len(room.players) >= MAX_PLAYERS:
            raise RoomFullError(f"La sala está llena ({MAX_PLAYERS} jugadores).")
        now = self._clock()
        player = room.players.get(user_id) or Player(id=user_id, name=name[:30], last_refill=now)
        room.players[user_id] = player
        self._room_of[user_id] = code
        return player

    def leave(self, user_id: str) -> str | None:
        """Saca al jugador. Devuelve el codigo de la sala que dejo (la sala vacia se borra)."""
        code = self._room_of.pop(user_id, None)
        room = self._rooms.get(code) if code else None
        if room is None:
            return None
        room.players.pop(user_id, None)
        if not room.players:
            del self._rooms[code]
        return code

    # ---------------------------------------------------------------- estado
    def allow_message(self, user_id: str) -> bool:
        """Cubo de fichas: como mucho MAX_MSG_PER_SECOND mensajes por segundo y jugador."""
        player = self._player(user_id)
        if player is None:
            return False
        now = self._clock()
        player.tokens = min(MAX_MSG_PER_SECOND, player.tokens + (now - player.last_refill) * MAX_MSG_PER_SECOND)
        player.last_refill = now
        if player.tokens < 1.0:
            return False
        player.tokens -= 1.0
        return True

    def apply_state(self, user_id: str, raw: object) -> tuple[dict | None, bool]:
        """
        Valida lo que mando el cliente y actualiza su estado.
        Devuelve (estado_publico | None, corregido): corregido=True si se rechazo la posicion por imposible
        (el cliente debe volver a la ultima posicion buena).
        """
        player = self._player(user_id)
        if player is None or not isinstance(raw, dict):
            return None, False
        x, y, z = (_number(raw.get(k), MAX_COORD) for k in ("x", "y", "z"))
        ry = _number(raw.get("ry"), 1000.0)
        if None in (x, y, z, ry):
            return None, False

        now = self._clock()
        state = player.state
        corrected = False
        if player.has_position:
            dt = max(0.0, now - player.last_update)
            moved = math.dist((state.x, state.z), (x, z))                 # el salto vertical no cuenta
            if moved > MAX_SPEED * dt + SPEED_SLACK or abs(y - state.y) > 200:
                corrected = True
        if not corrected:
            state.x, state.y, state.z = x, y, z
            player.has_position = True
            player.last_update = now
        state.ry = ry
        state.nadando = raw.get("nadando") is True
        state.golpe = raw.get("golpe") is True
        vida = raw.get("vida")
        if isinstance(vida, int) and not isinstance(vida, bool):
            state.vida = max(0, min(100, vida))
        arma = raw.get("arma")
        state.arma = arma if isinstance(arma, str) and arma in WEAPONS else ""
        state.sombrero = raw.get("sombrero") is not False
        nivel = raw.get("nivel")
        if isinstance(nivel, int) and not isinstance(nivel, bool) and 0 <= nivel <= 9:
            state.nivel = nivel
        return player.public(), corrected

    def _player(self, user_id: str) -> Player | None:
        code = self._room_of.get(user_id)
        room = self._rooms.get(code) if code else None
        return room.players.get(user_id) if room else None

"""
Suministros del mapa (Fase 4D): el servidor decide CUANDO aparece cada botiquin o kit de arma, CUANTO
dura, cuantos puede haber a la vez y QUE arma trae un kit. El cliente solo los dibuja y avisa cuando
el jugador llega hasta uno ("claim"); el servidor valida que existe, que esta vigente y que nadie lo
recogio antes. No se guardan entre partidas: cada partida (o nivel) abre una carrera nueva.

Dominio puro: el tiempo entra como parametro (segundos desde que empezo la carrera), asi se prueba
sin relojes reales.
"""
import math
import random
from dataclasses import dataclass, field

from app.domain.exceptions import ValidationError
from app.domain.game_rules import CLAIM_GRACE_SECONDS, KIT_WEAPONS, SUPPLIES, SUPPLY_CANDIDATES

KIND_HEALTH = "botiquin"
KIND_WEAPON = "arma"
KINDS = (KIND_HEALTH, KIND_WEAPON)


class SupplyUnavailableError(ValidationError):
    """El suministro no existe, ya expiro o ya lo recogieron."""


@dataclass
class SupplyItem:
    id: int
    kind: str
    spawn_at: float
    expire_at: float
    # posiciones candidatas en polar: angulo (rad) y fraccion de radio (0..1, ya con raiz para repartir parejo)
    candidates: list[tuple[float, float]]
    claimed: bool = False

    def is_active(self, now: float, grace: float = 0.0) -> bool:
        return not self.claimed and self.spawn_at <= now < self.expire_at + grace


@dataclass
class SupplyRun:
    run_id: str
    rng: random.Random
    rules: dict = field(default_factory=lambda: dict(SUPPLIES))
    items: dict[int, SupplyItem] = field(default_factory=dict)
    next_spawn_at: float = 0.0
    _next_id: int = 1

    def __post_init__(self) -> None:
        self.next_spawn_at = float(self.rules["cada"])

    # ------------------------------------------------------------------ avance del tiempo
    def advance(self, now: float) -> None:
        """Hace aparecer lo que ya toca y descarta lo vencido. Idempotente para el mismo `now`."""
        cada = float(self.rules["cada"])
        # tras mucho tiempo sin consultar, lo que habria aparecido ya vencio: se salta directo a lo vigente
        mas_viejo_util = now - float(self.rules["duracion"]) - CLAIM_GRACE_SECONDS
        if self.next_spawn_at < mas_viejo_util:
            self.next_spawn_at += math.ceil((mas_viejo_util - self.next_spawn_at) / cada) * cada
        while self.next_spawn_at <= now:
            for kind in KINDS:
                self._spawn(kind, self.next_spawn_at)
            self.next_spawn_at += cada
        grace = CLAIM_GRACE_SECONDS
        for item_id in [i for i, it in self.items.items() if it.claimed or now >= it.expire_at + grace]:
            del self.items[item_id]

    def _spawn(self, kind: str, at: float) -> None:
        # tope por tipo: se cuentan los vigentes en el momento de aparecer
        vigentes = sum(1 for it in self.items.values() if it.kind == kind and it.is_active(at))
        if vigentes >= int(self.rules["maxPorTipo"]):
            return
        candidates = [
            (self.rng.uniform(0, 2 * math.pi), math.sqrt(self.rng.random())) for _ in range(SUPPLY_CANDIDATES)
        ]
        item = SupplyItem(self._next_id, kind, at, at + float(self.rules["duracion"]), candidates)
        self._next_id += 1
        self.items[item.id] = item

    # ------------------------------------------------------------------ consultas
    def active(self, now: float) -> list[SupplyItem]:
        self.advance(now)
        return sorted((it for it in self.items.values() if it.is_active(now)), key=lambda it: it.id)

    # ------------------------------------------------------------------ recoger
    def claim(self, item_id: int, now: float) -> dict:
        """Marca el suministro como recogido y devuelve la recompensa (la decide el servidor)."""
        self.advance(now)
        item = self.items.get(item_id)
        if item is None or not item.is_active(now, grace=CLAIM_GRACE_SECONDS):
            raise SupplyUnavailableError("Ese suministro ya no esta disponible.")
        item.claimed = True
        if item.kind == KIND_HEALTH:
            return {"tipo": KIND_HEALTH, "curacion": int(self.rules["curacion"])}
        weapon = self.rng.choice(KIT_WEAPONS)
        return {
            "tipo": KIND_WEAPON,
            "arma": weapon,
            "municion": int(self.rules["balas"]) if weapon == "pistola" else 0,
        }

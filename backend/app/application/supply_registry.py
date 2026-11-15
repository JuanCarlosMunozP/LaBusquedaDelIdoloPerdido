"""
Estado en memoria de los suministros (Fase 4D):
  - SupplyRunRegistry: las carreras de suministros abiertas (una por partida/nivel de cada jugador).
  - GrantLedger: las armas que el servidor ya entrego por "claim" a cada cuenta, para que el
    inventario guardado no pueda traer armas que nunca se ganaron.

Es memoria del proceso: sirve con un solo worker (como se despliega hoy) y se pierde al reiniciar,
lo cual esta bien porque los suministros NO duran entre partidas. El reloj se inyecta para probar.
"""
import random
import secrets
import threading
import time
from collections import Counter, OrderedDict
from collections.abc import Callable

from app.domain.supplies import SupplyRun, SupplyUnavailableError

MAX_RUNS = 2000                 # tope de carreras abiertas a la vez (evita llenar la memoria)
RUN_IDLE_SECONDS = 2 * 3600     # una carrera sin consultas en 2 h se descarta
MAX_LEDGER_USERS = 5000


class SupplyRunRegistry:
    def __init__(self, clock: Callable[[], float] = time.monotonic, rules: dict | None = None):
        self._clock = clock
        self._rules = rules
        self._runs: OrderedDict[str, tuple[SupplyRun, float, float]] = OrderedDict()   # id -> (carrera, inicio, ultimo uso)
        self._lock = threading.Lock()

    def _purge(self, now: float) -> None:
        for run_id in [k for k, (_, _, used) in self._runs.items() if now - used > RUN_IDLE_SECONDS]:
            del self._runs[run_id]
        while len(self._runs) >= MAX_RUNS:
            self._runs.popitem(last=False)          # la mas antigua

    def start(self) -> tuple[str, float]:
        """Abre una carrera nueva. Devuelve (run_id, segundos transcurridos = 0)."""
        with self._lock:
            now = self._clock()
            self._purge(now)
            run_id = secrets.token_urlsafe(16)
            kwargs = {"rules": dict(self._rules)} if self._rules else {}
            run = SupplyRun(run_id, random.Random(secrets.randbits(64)), **kwargs)
            self._runs[run_id] = (run, now, now)
            return run_id, 0.0

    def _get(self, run_id: str) -> tuple[SupplyRun, float, float]:
        entry = self._runs.get(run_id)
        if entry is None:
            raise SupplyUnavailableError("La carrera de suministros no existe o expiro.")
        now = self._clock()
        run, started, _ = entry
        self._runs[run_id] = (run, started, now)
        return run, started, now - started

    def snapshot(self, run_id: str) -> tuple[SupplyRun, float]:
        """(carrera ya avanzada, segundos desde que empezo)."""
        with self._lock:
            run, _, elapsed = self._get(run_id)
            run.advance(elapsed)
            return run, elapsed

    def claim(self, run_id: str, item_id: int) -> dict:
        with self._lock:
            run, _, elapsed = self._get(run_id)
            return run.claim(item_id, elapsed)


class GrantLedger:
    """Cuenta, por jugador, las armas y balas entregadas que aun no aparecen en su inventario guardado."""

    def __init__(self) -> None:
        self._grants: OrderedDict[str, tuple[Counter, int]] = OrderedDict()
        self._lock = threading.Lock()

    def grant(self, user_id: str, weapon: str, ammo: int = 0) -> None:
        with self._lock:
            weapons, balas = self._grants.pop(user_id, (Counter(), 0))
            weapons[weapon] += 1
            self._grants[user_id] = (weapons, balas + max(0, ammo))
            while len(self._grants) > MAX_LEDGER_USERS:
                self._grants.popitem(last=False)

    def available(self, user_id: str) -> tuple[Counter, int]:
        with self._lock:
            weapons, balas = self._grants.get(user_id, (Counter(), 0))
            return Counter(weapons), balas

    def consume(self, user_id: str, weapons: Counter, ammo: int) -> None:
        with self._lock:
            have, balas = self._grants.get(user_id, (Counter(), 0))
            have.subtract(weapons)
            have = +have                                # descarta los que quedan en cero
            balas = max(0, balas - max(0, ammo))
            if have or balas:
                self._grants[user_id] = (have, balas)
            else:
                self._grants.pop(user_id, None)

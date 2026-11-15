"""Casos de uso de los suministros del mapa (la logica de aparicion y duracion esta en domain/supplies.py)."""
from app.application.supply_registry import GrantLedger, SupplyRunRegistry
from app.domain.game_rules import SUPPLIES
from app.domain.supplies import KIND_WEAPON


class StartSupplyRunUseCase:
    """Abre una carrera de suministros nueva (cada partida o nivel empieza de cero)."""

    def __init__(self, registry: SupplyRunRegistry):
        self.registry = registry

    def execute(self) -> dict:
        run_id, _ = self.registry.start()
        return self._state(run_id)

    def _state(self, run_id: str) -> dict:
        return GetSupplyRunUseCase(self.registry).execute(run_id)


class GetSupplyRunUseCase:
    """Estado vigente: que suministros hay, cuando aparece el proximo y la hora del servidor en la carrera."""

    def __init__(self, registry: SupplyRunRegistry):
        self.registry = registry

    def execute(self, run_id: str) -> dict:
        run, elapsed = self.registry.snapshot(run_id)
        return {
            "carrera": run_id,
            "ahora": round(elapsed, 3),
            "proxima": round(run.next_spawn_at, 3),
            "aviso": SUPPLIES["aviso"],
            "items": [
                {
                    "id": it.id,
                    "tipo": it.kind,
                    "aparece": round(it.spawn_at, 3),
                    "expira": round(it.expire_at, 3),
                    "candidatos": [{"angulo": round(a, 4), "fraccion": round(f, 4)} for a, f in it.candidates],
                }
                for it in run.active(elapsed)
            ],
        }


class ClaimSupplyUseCase:
    """Recoger un suministro. Si el jugador tiene cuenta, el arma entregada queda registrada para su inventario."""

    def __init__(self, registry: SupplyRunRegistry, ledger: GrantLedger):
        self.registry = registry
        self.ledger = ledger

    def execute(self, run_id: str, item_id: int, user_id: str | None) -> dict:
        reward = self.registry.claim(run_id, item_id)
        if user_id and reward["tipo"] == KIND_WEAPON:
            self.ledger.grant(user_id, reward["arma"], reward["municion"])
        return reward

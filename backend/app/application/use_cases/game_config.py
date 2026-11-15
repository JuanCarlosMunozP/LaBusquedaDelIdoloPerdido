"""Caso de uso: entregar al cliente las reglas fijas del juego."""
from app.domain.game_rules import GAME_RULES_VERSION, game_rules


class GetGameConfigUseCase:
    """Devuelve las reglas de combate, armas, balas y suministros (publicas, no dependen del jugador)."""

    def execute(self) -> dict:
        return {"version": GAME_RULES_VERSION, **game_rules()}

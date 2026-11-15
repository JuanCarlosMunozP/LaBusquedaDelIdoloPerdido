"""
Casos de uso de la capa de aplicacion, separados por responsabilidad:
  auth.py       registro, inicio y cierre de sesion
  progress.py   progreso del jugador (firma de integridad y reglas anti-trampa)
  inventory.py  inventario persistente (sombrero, arma de la mano y mochila)
  game_config.py reglas fijas del juego que consume el cliente
  supplies.py   suministros del mapa (aparicion, duracion y recompensas las decide el servidor)
Se reexportan aqui para que `from app.application.use_cases import X` siga funcionando.
"""
from app.application.use_cases.auth import (
    AuthenticateUserUseCase,
    RegisterUserUseCase,
    RevokeSessionUseCase,
)
from app.application.use_cases.game_config import GetGameConfigUseCase
from app.application.use_cases.inventory import GetInventoryUseCase, SaveInventoryUseCase
from app.application.use_cases.progress import GetProgressUseCase, UpdateProgressUseCase
from app.application.use_cases.supplies import (
    ClaimSupplyUseCase,
    GetSupplyRunUseCase,
    StartSupplyRunUseCase,
)

__all__ = [
    "AuthenticateUserUseCase",
    "ClaimSupplyUseCase",
    "GetSupplyRunUseCase",
    "StartSupplyRunUseCase",
    "GetGameConfigUseCase",
    "GetInventoryUseCase",
    "GetProgressUseCase",
    "RegisterUserUseCase",
    "RevokeSessionUseCase",
    "SaveInventoryUseCase",
    "UpdateProgressUseCase",
]

"""
Rutas de la API /api/v1, una por responsabilidad:
  health.py     estado del servicio
  auth.py       registro, inicio/cierre de sesion y sesion actual
  progress.py   progreso del jugador
  inventory.py  inventario persistente
  game.py       reglas fijas del juego
  supplies.py   suministros del mapa
  security.py   auditoria (admin)
`from app.presentation.routers import api_router` sigue funcionando.
"""
from fastapi import APIRouter

from app.presentation.routers import auth, game, health, inventory, progress, security, supplies

api_router = APIRouter(prefix="/api/v1")
for modulo in (health, auth, progress, inventory, game, supplies, security):
    api_router.include_router(modulo.router)

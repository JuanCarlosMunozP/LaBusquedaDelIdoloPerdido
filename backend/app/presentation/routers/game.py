"""Reglas fijas del juego para el cliente (publicas: no dependen de quien juega)."""
from fastapi import APIRouter

from app.application.use_cases import GetGameConfigUseCase
from app.presentation.schemas import GameConfigResponse

router = APIRouter()


@router.get("/game/config", response_model=GameConfigResponse, tags=["Game Rules"])
def get_game_config() -> dict:
    return GetGameConfigUseCase().execute()

"""Estado del servicio."""
from typing import Any
from app.core.config import settings
from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["Health"])
def health_check() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "target": settings.deploy_target,
        "architecture": "clean-architecture",
    }

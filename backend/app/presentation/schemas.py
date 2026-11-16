from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CredentialsRequest(StrictBaseModel):
    nombre: str = Field(..., min_length=1, max_length=64, description="Nombre visible del jugador")
    clave: str = Field(..., min_length=1, max_length=128, description="Contraseña del jugador")


class ProgressPayload(StrictBaseModel):
    nivel: int = Field(..., ge=1, le=3)
    mejorTiempo: int = Field(..., ge=0)
    victorias: int = Field(..., ge=0)


class AuthSuccessResponse(StrictBaseModel):
    ok: bool = True
    nombre: str
    csrfToken: str
    progreso: ProgressPayload
    aviso: str | None = None


class ProgressUpdateRequest(StrictBaseModel):
    nivel: int | None = Field(default=None, ge=1, le=3)
    tiempoVictoria: int | None = Field(default=None, ge=1, le=86400)


class AuditLogEntryResponse(StrictBaseModel):
    id: int | None
    event_type: str
    username: str | None
    ip_address: str
    user_agent: str
    details: dict[str, Any]
    created_at: datetime


class WeaponStackPayload(StrictBaseModel):
    arma: Literal["cuchillo", "bate", "machete", "pistola"]
    municion: int = Field(default=0, ge=0, le=10)


class InventoryPayload(StrictBaseModel):
    sombrero: Literal["puesto", "guardado"] = "guardado"
    enMano: WeaponStackPayload | None = None
    mochila: list[WeaponStackPayload] = Field(default_factory=list, max_length=3)


class CombatRules(StrictBaseModel):
    duracionGolpe: float = Field(..., gt=0)
    instanteImpacto: float = Field(..., gt=0)


class WeaponRules(StrictBaseModel):
    alcance: float = Field(..., gt=0)
    dano: float = Field(..., ge=0)
    golpeEnemigo: float = Field(..., ge=0)
    espera: float = Field(..., gt=0)


class BulletZoneThresholds(StrictBaseModel):
    cabeza: float
    pecho: float
    abdomen: float
    rodillaMin: float
    rodillaMax: float
    brazoLateral: float


class BulletDamage(StrictBaseModel):
    brazo: float
    abdomen: float
    rodilla: float
    pierna: float


class BulletRules(StrictBaseModel):
    umbrales: BulletZoneThresholds
    dano: BulletDamage


class SupplyRules(StrictBaseModel):
    cada: float = Field(..., gt=0)
    duracion: float = Field(..., gt=0)
    aviso: float = Field(..., ge=0)
    maxPorTipo: int = Field(..., ge=1)
    balas: int = Field(..., ge=1, le=10)
    curacion: int = Field(..., ge=0)
    vidaMaxima: int = Field(..., ge=1)


class GameConfigResponse(StrictBaseModel):
    version: int
    combate: CombatRules
    armas: dict[str, WeaponRules]
    balas: BulletRules
    suministros: SupplyRules


class SupplyCandidate(StrictBaseModel):
    angulo: float
    fraccion: float


class SupplyItemPayload(StrictBaseModel):
    id: int
    tipo: Literal["botiquin", "arma"]
    aparece: float
    expira: float
    candidatos: list[SupplyCandidate]


class SupplyRunPayload(StrictBaseModel):
    carrera: str
    ahora: float
    proxima: float
    aviso: float
    items: list[SupplyItemPayload]


class SupplyClaimRequest(StrictBaseModel):
    item: int = Field(..., ge=1)


class SupplyRewardPayload(StrictBaseModel):
    tipo: Literal["botiquin", "arma"]
    curacion: int | None = None
    arma: Literal["cuchillo", "bate", "machete", "pistola"] | None = None
    municion: int | None = None

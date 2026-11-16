from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.exceptions import ValidationError

HAT_STATES = ("puesto", "guardado")
MAX_BACKPACK = 3
MAX_PISTOL_AMMO = 10
# Armas que existen en los kits (los puños no se guardan: son "sin arma")
WEAPON_IDS = ("cuchillo", "bate", "machete", "pistola")


@dataclass
class WeaponStack:
    """Un arma con su munición. Solo la pistola usa balas."""

    arma: str
    municion: int = 0

    def validate(self) -> None:
        if self.arma not in WEAPON_IDS:
            raise ValidationError(f"Arma desconocida: {self.arma!r}.")
        if not isinstance(self.municion, int) or isinstance(self.municion, bool):
            raise ValidationError("La munición debe ser un entero.")
        if self.arma == "pistola":
            if not 1 <= self.municion <= MAX_PISTOL_AMMO:
                raise ValidationError(f"La pistola guarda entre 1 y {MAX_PISTOL_AMMO} balas.")
        elif self.municion != 0:
            raise ValidationError("Solo la pistola tiene munición.")


@dataclass
class PlayerInventory:
    """
    Inventario persistente del jugador (CU inventario, Fase 4B): estado del sombrero, arma en la
    mano y mochila. Las reglas viven aquí (servidor); el cliente solo las muestra.
    """

    user_id: str
    hat_state: str = "guardado"
    equipped: WeaponStack | None = None
    backpack: list[WeaponStack] = field(default_factory=list)
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def validate(self) -> None:
        if self.hat_state not in HAT_STATES:
            raise ValidationError(f"Estado de sombrero inválido: {self.hat_state!r}.")
        if len(self.backpack) > MAX_BACKPACK:
            raise ValidationError(f"La mochila guarda como máximo {MAX_BACKPACK} armas.")
        if self.equipped is not None:
            self.equipped.validate()
        for item in self.backpack:
            item.validate()

    def weapon_totals(self) -> tuple[Counter, int]:
        """Cuantas armas de cada tipo tiene (mano + mochila) y cuantas balas en total."""
        stacks = ([self.equipped] if self.equipped else []) + list(self.backpack)
        return Counter(i.arma for i in stacks), sum(i.municion for i in stacks)

    def replace_with(
        self,
        hat_state: str,
        equipped: WeaponStack | None,
        backpack: list[WeaponStack],
    ) -> None:
        """Reemplaza el contenido tras validarlo; si algo es inválido no cambia nada."""
        candidate = PlayerInventory(self.user_id, hat_state, equipped, list(backpack))
        candidate.validate()
        self.hat_state = candidate.hat_state
        self.equipped = candidate.equipped
        self.backpack = candidate.backpack
        self.updated_at = datetime.now(timezone.utc)

"""Casos de uso del inventario persistente del jugador."""
from app.domain.entities.audit_log import SecurityAuditLog
from app.domain.entities.inventory import (
    PlayerInventory,
    WeaponStack,
)
from app.application.supply_registry import GrantLedger
from app.domain.exceptions import (
    InvalidCredentialsError,
    TamperDetectedError,
    ValidationError,
)
from app.domain.repositories import (
    AbstractAuditRepository,
    AbstractInventoryRepository,
    AbstractUserRepository,
)


class GetInventoryUseCase:
    """Cargar el inventario del jugador (sombrero, arma en mano y mochila). Sin registro previo: valores por defecto."""

    def __init__(self, user_repo: AbstractUserRepository, inventory_repo: AbstractInventoryRepository):
        self.user_repo = user_repo
        self.inventory_repo = inventory_repo

    def execute(self, username: str) -> PlayerInventory:
        user = self.user_repo.get_by_username(username.lower())
        if user is None:
            raise InvalidCredentialsError("Sesión inválida.")
        return self.inventory_repo.get_by_user_id(user.id) or PlayerInventory(user_id=user.id)


class SaveInventoryUseCase:
    """
    Guardar el inventario aplicando las reglas del dominio; lo inválido se rechaza y se audita.
    Con `ledger`, ademas, no se aceptan armas ni balas de mas que el servidor no haya entregado
    (por suministros recogidos): intercambiar, guardar o perder armas siempre se permite.
    """

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        inventory_repo: AbstractInventoryRepository,
        audit_repo: AbstractAuditRepository,
        ledger: GrantLedger | None = None,
    ):
        self.user_repo = user_repo
        self.inventory_repo = inventory_repo
        self.audit_repo = audit_repo
        self.ledger = ledger

    def execute(
        self,
        username: str,
        hat_state: str,
        equipped: WeaponStack | None,
        backpack: list[WeaponStack],
        ip_address: str,
        user_agent: str,
    ) -> PlayerInventory:
        user = self.user_repo.get_by_username(username.lower())
        if user is None:
            raise InvalidCredentialsError("Sesión inválida.")
        inventory = self.inventory_repo.get_by_user_id(user.id) or PlayerInventory(user_id=user.id)
        weapons_before, ammo_before = inventory.weapon_totals()
        try:
            inventory.replace_with(hat_state, equipped, backpack)
        except ValidationError as exc:
            self._audit("INVENTORY_REJECTED", user, ip_address, user_agent, {"reason": str(exc)})
            raise

        if self.ledger is not None:
            weapons_after, ammo_after = inventory.weapon_totals()
            extra_weapons = weapons_after - weapons_before          # solo lo que aumento
            extra_ammo = max(0, ammo_after - ammo_before)
            granted_weapons, granted_ammo = self.ledger.available(user.id)
            if any(n > granted_weapons[w] for w, n in extra_weapons.items()) or extra_ammo > granted_ammo:
                details = {
                    "reason": "Inventario con armas o balas que el servidor no entrego.",
                    "extra_weapons": dict(extra_weapons),
                    "extra_ammo": extra_ammo,
                }
                self._audit("TAMPER_BLOCKED", user, ip_address, user_agent, details)
                raise TamperDetectedError(details["reason"])
            self.ledger.consume(user.id, extra_weapons, extra_ammo)
        return self.inventory_repo.save(inventory)

    def _audit(self, event_type: str, user, ip_address: str, user_agent: str, details: dict) -> None:
        self.audit_repo.record(
            SecurityAuditLog(
                event_type=event_type,
                user_id=user.id,
                username=user.username,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details,
            )
        )

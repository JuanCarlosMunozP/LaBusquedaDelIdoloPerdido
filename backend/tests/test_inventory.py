import os

os.environ["DATABASE_URL"] = "sqlite:///./test_security.db"
os.environ["SECRET_KEY"] = "test-secret-key-hmac-256-bits-for-automated-suite"
os.environ["ADMIN_AUDIT_TOKEN"] = "token-admin-auditoria-2026"
os.environ["COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient
import pytest

from app.domain.entities.inventory import PlayerInventory, WeaponStack
from app.domain.exceptions import ValidationError
from app.application.supply_registry import GrantLedger
from app.infrastructure.models import Base, UserModel
from app.infrastructure.session import SessionLocal, engine
from app.presentation import dependencies
from app.main import app, reset_rate_limiter


@pytest.fixture(autouse=True)
def clean_db(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    reset_rate_limiter()
    monkeypatch.setattr(dependencies, "_grant_ledger", GrantLedger())    # cada test empieza sin armas entregadas
    yield


def _conceder(nombre, *armas):
    """Simula que el servidor ya entrego estas armas (en el juego salen de recoger suministros)."""
    with SessionLocal() as db:
        user_id = db.query(UserModel).filter(UserModel.username == nombre.lower()).first().id
    for arma, balas in armas:
        dependencies.get_grant_ledger().grant(user_id, arma, balas)


def _registrar(client, nombre="Explorador_Inv"):
    res = client.post("/api/v1/auth/register", json={"nombre": nombre, "clave": "ClaveSegura#26"})
    assert res.status_code == 201
    return {"X-CSRF-Token": res.json()["csrfToken"]}


# ---------------------------------------------------------------- dominio
def test_domain_rules_for_weapons_and_backpack():
    inv = PlayerInventory(user_id="u1")
    inv.replace_with("guardado", WeaponStack("pistola", 7), [WeaponStack("bate"), WeaponStack("cuchillo")])
    assert inv.hat_state == "guardado" and inv.equipped.municion == 7

    for malo in (
        ("volando", None, []),                                        # sombrero inexistente
        ("puesto", WeaponStack("bazuca", 0), []),                      # arma inexistente
        ("puesto", WeaponStack("pistola", 0), []),                     # pistola sin balas
        ("puesto", WeaponStack("pistola", 11), []),                    # demasiadas balas
        ("puesto", WeaponStack("bate", 3), []),                        # balas en un bate
        ("puesto", None, [WeaponStack("bate")] * 4),                   # mochila de 4
    ):
        with pytest.raises(ValidationError):
            inv.replace_with(*malo)
    # lo invalido no modifica el inventario
    assert inv.hat_state == "guardado" and inv.equipped.arma == "pistola" and len(inv.backpack) == 2


# ---------------------------------------------------------------- API
def test_inventory_requires_session_and_csrf():
    with TestClient(app) as client:
        assert client.get("/api/v1/inventory").status_code == 401
        assert client.put("/api/v1/inventory", json={"sombrero": "guardado"}).status_code in (401, 403)
        _registrar(client)
        assert client.put("/api/v1/inventory", json={"sombrero": "guardado"}).status_code == 403   # sin CSRF


def test_new_player_has_default_inventory():
    with TestClient(app) as client:
        _registrar(client)
        res = client.get("/api/v1/inventory")
        assert res.status_code == 200
        assert res.json() == {"sombrero": "guardado", "enMano": None, "mochila": []}


def test_hat_and_backpack_persist_between_sessions():
    """El bug del sombrero: lo guardado sigue guardado aunque se cierre sesion y se vuelva a entrar."""
    with TestClient(app) as client:
        csrf = _registrar(client)
        _conceder("Explorador_Inv", ("pistola", 10), ("bate", 0), ("cuchillo", 0))
        cuerpo = {
            "sombrero": "guardado",
            "enMano": {"arma": "pistola", "municion": 6},
            "mochila": [{"arma": "bate", "municion": 0}, {"arma": "cuchillo", "municion": 0}],
        }
        assert client.put("/api/v1/inventory", json=cuerpo, headers=csrf).json() == cuerpo
        assert client.post("/api/v1/auth/logout", headers=csrf).status_code == 200

    with TestClient(app) as otro:
        res = otro.post("/api/v1/auth/login", json={"nombre": "Explorador_Inv", "clave": "ClaveSegura#26"})
        assert res.status_code == 200
        assert otro.get("/api/v1/inventory").json() == cuerpo


def test_inventories_are_isolated_between_players():
    with TestClient(app) as a, TestClient(app) as b:
        csrf_a = _registrar(a, "Jugador_A")
        _registrar(b, "Jugador_B")
        a.put("/api/v1/inventory", json={"sombrero": "puesto"}, headers=csrf_a)
        assert b.get("/api/v1/inventory").json()["sombrero"] == "guardado"   # el defecto: lo lleva guardado


def test_invalid_inventory_is_rejected_and_audited():
    with TestClient(app) as client:
        csrf = _registrar(client)
        malos = [
            {"sombrero": "volando"},
            {"enMano": {"arma": "bazuca", "municion": 0}},
            {"enMano": {"arma": "pistola", "municion": 0}},         # regla de dominio: sin balas no se guarda
            {"enMano": {"arma": "bate", "municion": 5}},
            {"mochila": [{"arma": "bate", "municion": 0}] * 4},
            {"sombrero": "puesto", "extra": 1},                      # campos desconocidos
        ]
        for cuerpo in malos:
            assert client.put("/api/v1/inventory", json=cuerpo, headers=csrf).status_code in (400, 422), cuerpo
        # nada se guardo
        assert client.get("/api/v1/inventory").json() == {"sombrero": "guardado", "enMano": None, "mochila": []}
        # y la regla de dominio (no la de formato) dejo rastro de auditoria
        logs = client.get(
            "/api/v1/security/audit-logs", headers={"X-Admin-Audit-Token": "token-admin-auditoria-2026"}
        ).json()
        assert any(item["event_type"] == "INVENTORY_REJECTED" for item in logs)


def test_weapons_the_server_never_granted_are_rejected_and_audited():
    with TestClient(app) as client:
        csrf = _registrar(client)
        res = client.put("/api/v1/inventory", json={"enMano": {"arma": "bate", "municion": 0}}, headers=csrf)
        assert res.status_code == 403
        assert client.get("/api/v1/inventory").json()["enMano"] is None
        logs = client.get(
            "/api/v1/security/audit-logs", headers={"X-Admin-Audit-Token": "token-admin-auditoria-2026"}
        ).json()
        assert any(item["event_type"] == "TAMPER_BLOCKED" for item in logs)


def test_granted_weapons_can_be_swapped_stored_and_dropped_without_new_grants():
    with TestClient(app) as client:
        csrf = _registrar(client)
        _conceder("Explorador_Inv", ("bate", 0), ("pistola", 10))
        mano = {"sombrero": "puesto", "enMano": {"arma": "pistola", "municion": 10}, "mochila": [{"arma": "bate", "municion": 0}]}
        assert client.put("/api/v1/inventory", json=mano, headers=csrf).status_code == 200
        # intercambiar mano y mochila, gastar balas y soltar el arma son siempre validos
        cambio = {"sombrero": "puesto", "enMano": {"arma": "bate", "municion": 0}, "mochila": [{"arma": "pistola", "municion": 7}]}
        assert client.put("/api/v1/inventory", json=cambio, headers=csrf).status_code == 200
        perdida = {"sombrero": "puesto", "enMano": None, "mochila": [{"arma": "pistola", "municion": 7}]}
        assert client.put("/api/v1/inventory", json=perdida, headers=csrf).status_code == 200


def test_ammo_cannot_be_refilled_or_weapons_duplicated_without_a_grant():
    with TestClient(app) as client:
        csrf = _registrar(client)
        _conceder("Explorador_Inv", ("pistola", 10))
        base = {"enMano": {"arma": "pistola", "municion": 3}}
        assert client.put("/api/v1/inventory", json=base, headers=csrf).status_code == 200
        recarga = {"enMano": {"arma": "pistola", "municion": 10}}               # mas balas de las que tenia
        assert client.put("/api/v1/inventory", json=recarga, headers=csrf).status_code == 403
        copia = {"enMano": {"arma": "pistola", "municion": 3}, "mochila": [{"arma": "pistola", "municion": 1}]}
        assert client.put("/api/v1/inventory", json=copia, headers=csrf).status_code == 403

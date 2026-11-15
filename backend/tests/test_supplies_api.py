import os

os.environ["DATABASE_URL"] = "sqlite:///./test_security.db"
os.environ["SECRET_KEY"] = "test-secret-key-hmac-256-bits-for-automated-suite"
os.environ["ADMIN_AUDIT_TOKEN"] = "token-admin-auditoria-2026"
os.environ["COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient
import pytest

from app.application.supply_registry import GrantLedger, SupplyRunRegistry
from app.infrastructure.models import Base
from app.infrastructure.session import engine
from app.main import app, reset_rate_limiter
from app.presentation import dependencies


class RelojFalso:
    def __init__(self):
        self.t = 5000.0

    def __call__(self):
        return self.t


@pytest.fixture(autouse=True)
def entorno(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    reset_rate_limiter()
    reloj = RelojFalso()
    monkeypatch.setattr(dependencies, "_supply_registry", SupplyRunRegistry(clock=reloj))
    monkeypatch.setattr(dependencies, "_grant_ledger", GrantLedger())
    return reloj


def _iniciar(client):
    res = client.post("/api/v1/supplies/runs")
    assert res.status_code == 201
    return res.json()


def test_a_new_run_starts_empty_and_announces_the_first_spawn(entorno):
    with TestClient(app) as client:
        carrera = _iniciar(client)
        assert carrera["items"] == [] and carrera["ahora"] == 0 and carrera["proxima"] == 10 and carrera["aviso"] == 10


def test_supplies_appear_every_10_seconds_with_positions_to_render(entorno):
    with TestClient(app) as client:
        carrera = _iniciar(client)
        entorno.t += 10.2
        estado = client.get(f"/api/v1/supplies/runs/{carrera['carrera']}").json()
        assert sorted(i["tipo"] for i in estado["items"]) == ["arma", "botiquin"]
        assert estado["proxima"] == 20 and abs(estado["ahora"] - 10.2) < 1e-6
        assert all(len(i["candidatos"]) == 12 and i["expira"] - i["aparece"] == 60 for i in estado["items"])


def test_guests_can_pick_up_without_an_account_and_nobody_can_pick_twice(entorno):
    with TestClient(app) as client:
        run = _iniciar(client)["carrera"]
        entorno.t += 10
        items = client.get(f"/api/v1/supplies/runs/{run}").json()["items"]
        botiquin = next(i for i in items if i["tipo"] == "botiquin")
        res = client.post(f"/api/v1/supplies/runs/{run}/claim", json={"item": botiquin["id"]})
        assert res.status_code == 200 and res.json()["tipo"] == "botiquin" and res.json()["curacion"] == 40
        assert client.post(f"/api/v1/supplies/runs/{run}/claim", json={"item": botiquin["id"]}).status_code == 404
        despues = client.get(f"/api/v1/supplies/runs/{run}").json()["items"]
        assert botiquin["id"] not in [i["id"] for i in despues]


def test_unknown_runs_and_items_and_expired_supplies_return_404(entorno):
    with TestClient(app) as client:
        assert client.get("/api/v1/supplies/runs/no-existe").status_code == 404
        assert client.post("/api/v1/supplies/runs/no-existe/claim", json={"item": 1}).status_code == 404
        run = _iniciar(client)["carrera"]
        entorno.t += 10
        assert client.post(f"/api/v1/supplies/runs/{run}/claim", json={"item": 999}).status_code == 404
        item = client.get(f"/api/v1/supplies/runs/{run}").json()["items"][0]
        entorno.t += 70
        assert client.post(f"/api/v1/supplies/runs/{run}/claim", json={"item": item["id"]}).status_code == 404


def test_each_run_is_independent_so_nothing_lasts_between_games(entorno):
    with TestClient(app) as client:
        vieja = _iniciar(client)["carrera"]
        entorno.t += 30
        assert len(client.get(f"/api/v1/supplies/runs/{vieja}").json()["items"]) == 6
        nueva = _iniciar(client)
        assert nueva["carrera"] != vieja and nueva["items"] == []


def test_invalid_claim_bodies_are_rejected(entorno):
    with TestClient(app) as client:
        run = _iniciar(client)["carrera"]
        for cuerpo in ({}, {"item": 0}, {"item": "x"}, {"item": 1, "extra": 2}):
            assert client.post(f"/api/v1/supplies/runs/{run}/claim", json=cuerpo).status_code == 422


def test_a_logged_in_player_needs_csrf_and_the_weapon_won_can_then_be_saved(entorno):
    with TestClient(app) as client:
        reg = client.post("/api/v1/auth/register", json={"nombre": "Cazador_1", "clave": "ClaveSegura#26"})
        csrf = {"X-CSRF-Token": reg.json()["csrfToken"]}
        run = _iniciar(client)["carrera"]
        entorno.t += 10
        arma = next(i for i in client.get(f"/api/v1/supplies/runs/{run}").json()["items"] if i["tipo"] == "arma")
        assert client.post(f"/api/v1/supplies/runs/{run}/claim", json={"item": arma["id"]}).status_code == 403   # sin CSRF
        premio = client.post(f"/api/v1/supplies/runs/{run}/claim", json={"item": arma["id"]}, headers=csrf).json()
        assert premio["tipo"] == "arma" and premio["arma"] in ("cuchillo", "bate", "machete", "pistola")
        guardado = client.put(
            "/api/v1/inventory",
            json={"enMano": {"arma": premio["arma"], "municion": premio["municion"]}},
            headers=csrf,
        )
        assert guardado.status_code == 200
        # y no se puede guardar un arma distinta de la que el servidor entrego
        otra = "bate" if premio["arma"] != "bate" else "cuchillo"
        mochila = [{"arma": otra, "municion": 0}]
        mano = {"arma": premio["arma"], "municion": premio["municion"]}
        assert client.put("/api/v1/inventory", json={"enMano": mano, "mochila": mochila}, headers=csrf).status_code == 403

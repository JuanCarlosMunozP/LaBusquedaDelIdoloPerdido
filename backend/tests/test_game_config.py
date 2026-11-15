import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_security.db"
os.environ["SECRET_KEY"] = "test-secret-key-hmac-256-bits-for-automated-suite"
os.environ["ADMIN_AUDIT_TOKEN"] = "token-admin-auditoria-2026"
os.environ["COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient

from app.domain.game_rules import game_rules
from app.main import app

APP_DIR = Path(__file__).resolve().parents[1] / "app"


def test_game_config_is_public_and_keeps_the_original_values():
    with TestClient(app) as client:
        res = client.get("/api/v1/game/config")
    assert res.status_code == 200
    cfg = res.json()
    # exactamente lo que el juego tenia fijo en el frontend
    assert cfg["combate"] == {"duracionGolpe": 0.5, "instanteImpacto": 0.25}
    assert cfg["armas"]["bate"] == {"alcance": 2.1, "dano": 14, "golpeEnemigo": 2.5, "espera": 1.8}
    assert cfg["armas"]["puños"]["dano"] == 4
    assert set(cfg["armas"]) == {"puños", "cuchillo", "bate", "machete", "pistola"}
    assert cfg["balas"]["dano"] == {"brazo": 10, "abdomen": 20, "rodilla": 10, "pierna": 10}
    assert cfg["balas"]["umbrales"]["cabeza"] == 1.55
    assert cfg["suministros"] == {
        "cada": 10, "duracion": 60, "aviso": 10, "maxPorTipo": 6, "balas": 10, "curacion": 40, "vidaMaxima": 100,
    }


def test_impact_happens_inside_the_swing():
    combate = game_rules()["combate"]
    assert 0 < combate["instanteImpacto"] < combate["duracionGolpe"]


def test_returned_rules_are_copies_so_nobody_can_alter_the_server_constants():
    primera = game_rules()
    primera["combate"]["duracionGolpe"] = 99
    primera["armas"]["bate"]["dano"] = 9999
    segunda = game_rules()
    assert segunda["combate"]["duracionGolpe"] == 0.5
    assert segunda["armas"]["bate"]["dano"] == 14


def test_no_backend_module_exceeds_500_lines():
    """Separar por responsabilidades: ningun modulo crece sin control."""
    largos = {
        str(p.relative_to(APP_DIR)): len(p.read_text(encoding="utf8").splitlines())
        for p in APP_DIR.rglob("*.py")
    }
    assert {k: v for k, v in largos.items() if v > 500} == {}

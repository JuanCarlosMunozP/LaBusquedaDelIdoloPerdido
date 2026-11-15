import os

os.environ["DATABASE_URL"] = "sqlite:///./test_security.db"
os.environ["SECRET_KEY"] = "test-secret-key-hmac-256-bits-for-automated-suite"
os.environ["ADMIN_AUDIT_TOKEN"] = "token-admin-auditoria-2026"
os.environ["COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient
import pytest

from app.core.config import settings
from app.core.origin import origen_permitido
from app.infrastructure.models import Base
from app.infrastructure.session import engine
from app.main import app, reset_rate_limiter

CLAVE = "ClaveSegura#26"


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    reset_rate_limiter()
    yield


def _registrar(client, nombre, **cabeceras):
    return client.post("/api/v1/auth/register", json={"nombre": nombre, "clave": CLAVE}, headers=cabeceras)


# ---------------------------------------------------------------- Origin
def test_origin_de_otro_sitio_se_rechaza_pero_el_propio_se_acepta():
    with TestClient(app, base_url="https://juego.example.com") as client:
        assert _registrar(client, "Origen_Malo", Origin="https://malicioso.example.net").status_code == 403
        assert _registrar(client, "Origen_Null", Origin="null").status_code == 403
        assert _registrar(client, "Origen_Cruzado", **{"Sec-Fetch-Site": "cross-site"}).status_code == 403
        assert _registrar(client, "Origen_Bueno", Origin="https://juego.example.com").status_code == 201


def test_sin_cabeceras_de_navegador_no_se_toca_la_peticion():
    with TestClient(app) as client:
        assert _registrar(client, "Cliente_Curl").status_code == 201


def test_las_lecturas_no_se_filtran_por_origin():
    with TestClient(app, base_url="https://juego.example.com") as client:
        assert client.get("/api/v1/health", headers={"Origin": "https://otro.example.net"}).status_code == 200


def test_funcion_origen_permitido():
    class Ajustes:
        origin_check_enabled = True
        allowed_origin_hosts = ("extra.example.org",)
        environment = "production"

    ok = lambda met, **cab: origen_permitido(met, {k.lower().replace("_", "-"): v for k, v in cab.items()}, Ajustes)
    assert ok("PUT", host="juego.example.com", origin="https://juego.example.com")
    assert ok("PUT", host="juego.example.com:8443", origin="https://juego.example.com:8443")
    assert ok("PUT", host="juego.example.com", origin="https://extra.example.org")
    assert not ok("PUT", host="juego.example.com", origin="http://localhost:5173")      # produccion: nada de localhost
    assert ok("GET", host="juego.example.com", origin="https://otro.example.net")        # lectura: no aplica
    Ajustes.environment = "development"
    assert ok("PUT", host="127.0.0.1:8000", origin="http://localhost:5173")               # Vite en desarrollo


# ---------------------------------------------------------------- limites de escritura y registro
def test_guardados_seguidos_se_frenan_por_sesion_e_ip(monkeypatch):
    monkeypatch.setattr("app.main.settings", type("S", (), {**{k: getattr(settings, k) for k in dir(settings) if not k.startswith("_")}, "write_rate_limit_per_minute": 3})())
    with TestClient(app) as client:
        res = _registrar(client, "Escritor_Rapido")
        csrf = {"X-CSRF-Token": res.json()["csrfToken"]}
        codigos = [client.put("/api/v1/inventory", json={"sombrero": "puesto"}, headers=csrf).status_code for _ in range(5)]
        assert codigos[:3] == [200, 200, 200]
        assert codigos[3:] == [429, 429]


def test_registro_masivo_desde_una_ip_se_frena(monkeypatch):
    monkeypatch.setattr("app.main.settings", type("S", (), {**{k: getattr(settings, k) for k in dir(settings) if not k.startswith("_")}, "register_rate_limit_per_hour": 2, "auth_rate_limit_per_minute": 50})())
    with TestClient(app) as client:
        assert _registrar(client, "Cuenta_Uno").status_code == 201
        assert _registrar(client, "Cuenta_Dos").status_code == 201
        assert _registrar(client, "Cuenta_Tres").status_code == 429

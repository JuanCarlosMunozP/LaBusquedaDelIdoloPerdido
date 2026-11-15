import pytest

from app.domain.multiplayer import (
    MAX_PLAYERS,
    RoomFullError,
    RoomNotFoundError,
    RoomRegistry,
)


class Reloj:
    def __init__(self):
        self.t = 100.0

    def __call__(self):
        return self.t


def nuevo():
    reloj = Reloj()
    return RoomRegistry(clock=reloj), reloj


def estado(x=0, z=0, **extra):
    return {"t": "estado", "x": x, "y": 0, "z": z, "ry": 0, **extra}


def test_codigo_de_sala_legible():
    reg, _ = nuevo()
    codigo = reg.create_room()
    assert len(codigo) == 5
    assert not set(codigo) & set("01OIL")
    assert reg.normalize_code(f"  {codigo.lower()} ") == codigo


def test_maximo_cuatro_jugadores():
    reg, _ = nuevo()
    c = reg.create_room()
    for i in range(MAX_PLAYERS):
        reg.join(c, f"u{i}", f"Jugador {i}")
    with pytest.raises(RoomFullError):
        reg.join(c, "u4", "Quinto")
    reg.join(c, "u0", "Jugador 0")            # volver a entrar el mismo no ocupa lugar extra
    assert len(reg.snapshot(c)) == 4
    reg.leave("u3")
    reg.join(c, "u4", "Quinto")               # con un lugar libre ya entra


def test_sala_inexistente_y_sala_vacia_se_borra():
    reg, _ = nuevo()
    with pytest.raises(RoomNotFoundError):
        reg.join("ZZZZZ", "u1", "A")
    c = reg.create_room()
    reg.join(c, "u1", "A")
    assert reg.leave("u1") == c
    assert reg.room_count() == 0
    assert reg.leave("u1") is None


def test_una_cuenta_solo_en_una_sala():
    reg, _ = nuevo()
    a, b = reg.create_room(), reg.create_room()
    reg.join(a, "u1", "A")
    reg.join(b, "u1", "A")
    assert reg.room_of("u1") == b
    assert reg.room_count() == 1              # la primera quedo vacia y se cerro


def test_tope_de_salas():
    reg = RoomRegistry(max_rooms=2)
    reg.create_room()
    reg.create_room()
    with pytest.raises(Exception):
        reg.create_room()


def test_estado_valido_se_guarda_y_se_publica():
    reg, _ = nuevo()
    c = reg.create_room()
    reg.join(c, "u1", "Ana")
    pub, corregido = reg.apply_state("u1", estado(3, 4, nadando=True, vida=70, arma="bate", sombrero=False))
    assert not corregido
    assert pub["nombre"] == "Ana" and pub["x"] == 3 and pub["nadando"] is True
    assert pub["vida"] == 70 and pub["arma"] == "bate" and pub["sombrero"] is False
    assert pub["nivel"] == 0
    assert reg.apply_state("u1", estado(nivel=2))[0]["nivel"] == 2
    assert reg.apply_state("u1", estado(nivel=99))[0]["nivel"] == 2      # nivel invalido: se queda el anterior


def test_datos_basura_se_rechazan_o_se_limpian():
    reg, _ = nuevo()
    c = reg.create_room()
    reg.join(c, "u1", "Ana")
    for malo in (None, "x", [], {"x": "1", "y": 0, "z": 0, "ry": 0}, estado(float("nan")), estado(1e9),
                 estado(True), {"x": 1, "y": 2, "ry": 0}):
        assert reg.apply_state("u1", malo) == (None, False)
    pub, _ = reg.apply_state("u1", estado(vida=9999, arma="bazuka"))
    assert pub["vida"] == 100 and pub["arma"] == ""
    pub, _ = reg.apply_state("u1", estado(vida=True))
    assert pub["vida"] == 100                 # un booleano no es una vida
    assert reg.apply_state("desconocido", estado()) == (None, False)


def test_teletransporte_se_corrige_y_correr_no():
    reg, reloj = nuevo()
    c = reg.create_room()
    reg.join(c, "u1", "Ana")
    reg.apply_state("u1", estado(0, 0))
    reloj.t += 1.0
    pub, corregido = reg.apply_state("u1", estado(12, 0))          # 12 m en 1 s: corriendo
    assert not corregido and pub["x"] == 12
    reloj.t += 0.1
    pub, corregido = reg.apply_state("u1", estado(300, 0))         # 288 m en 0.1 s: imposible
    assert corregido and pub["x"] == 12                            # se queda donde estaba
    reloj.t += 10
    pub, corregido = reg.apply_state("u1", estado(100, 0))         # tras mucho rato si puede haber llegado
    assert not corregido and pub["x"] == 100


def test_limite_de_mensajes_por_segundo():
    reg, reloj = nuevo()
    c = reg.create_room()
    reg.join(c, "u1", "Ana")
    permitidos = sum(reg.allow_message("u1") for _ in range(100))
    assert 25 <= permitidos <= 31                                  # el cubo ya traia fichas
    assert not reg.allow_message("u1")
    reloj.t += 1.0
    assert reg.allow_message("u1")                                 # se rellena con el tiempo
    assert not reg.allow_message("nadie")

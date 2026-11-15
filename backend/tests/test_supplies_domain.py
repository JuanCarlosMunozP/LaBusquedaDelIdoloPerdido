"""Reglas de los suministros (dominio puro, sin FastAPI ni base de datos): se pueden correr aisladas."""
import random
from collections import Counter

import pytest

from app.application.supply_registry import GrantLedger, SupplyRunRegistry
from app.domain.game_rules import CLAIM_GRACE_SECONDS, KIT_WEAPONS, SUPPLIES, SUPPLY_CANDIDATES
from app.domain.supplies import SupplyRun, SupplyUnavailableError


def nueva(seed=1, **reglas) -> SupplyRun:
    return SupplyRun("r1", random.Random(seed), rules={**SUPPLIES, **reglas})


class RelojFalso:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


def test_nothing_before_the_first_interval_then_one_of_each_every_10_seconds():
    run = nueva()
    assert run.active(9.9) == []
    primeros = run.active(10.0)
    assert sorted(i.kind for i in primeros) == ["arma", "botiquin"]
    assert {i.spawn_at for i in primeros} == {10.0}
    assert len(run.active(20.0)) == 4


def test_each_supply_lasts_exactly_the_configured_duration():
    run = nueva()
    run2 = nueva(maxPorTipo=1)
    assert len(run2.active(10.0)) == 2
    assert len(run2.active(69.9)) == 2                                   # el de t=10 vive hasta t=70
    ids_viejos = {i.id for i in run2.active(69.9) if i.spawn_at == 10.0}
    assert ids_viejos and all(i.id not in ids_viejos for i in run2.active(70.0))


def test_never_more_than_the_max_per_kind_if_nobody_picks_them_up():
    run = nueva()
    for t in range(10, 600, 10):
        activos = run.active(float(t))
        assert Counter(i.kind for i in activos)["botiquin"] <= SUPPLIES["maxPorTipo"]
        assert Counter(i.kind for i in activos)["arma"] <= SUPPLIES["maxPorTipo"]
    final = Counter(i.kind for i in run.active(600.0))
    assert final["botiquin"] == final["arma"] == 6                       # 60 s / 10 s por tipo


def test_the_limit_is_respected_and_frees_up_when_one_is_picked():
    run = nueva(maxPorTipo=2, duracion=1000)
    run.active(50.0)                                                     # 5 apariciones, solo caben 2 de cada
    assert Counter(i.kind for i in run.active(50.0)) == {"botiquin": 2, "arma": 2}
    botiquin = next(i for i in run.active(50.0) if i.kind == "botiquin")
    run.claim(botiquin.id, 50.0)
    run.active(60.0)                                                     # en t=60 vuelve a aparecer uno
    assert Counter(i.kind for i in run.active(60.0))["botiquin"] == 2


def test_health_reward_and_weapon_reward_come_from_the_server():
    run = nueva(seed=7)
    run.active(10.0)
    botiquin = next(i for i in run.active(10.0) if i.kind == "botiquin")
    assert run.claim(botiquin.id, 10.0) == {"tipo": "botiquin", "curacion": 40}
    vistas = set()
    for t in range(10, 800, 10):
        for i in run.active(float(t)):
            if i.kind == "arma":
                premio = run.claim(i.id, float(t))
                assert premio["tipo"] == "arma" and premio["arma"] in KIT_WEAPONS
                assert premio["municion"] == (10 if premio["arma"] == "pistola" else 0)
                vistas.add(premio["arma"])
    assert vistas == set(KIT_WEAPONS)                                    # a la larga salen todas las armas


def test_a_supply_cannot_be_picked_twice_or_before_it_appears_or_after_it_expires():
    run = nueva()
    run.active(10.0)
    item = run.active(10.0)[0]
    run.claim(item.id, 10.0)
    with pytest.raises(SupplyUnavailableError):
        run.claim(item.id, 10.5)                                          # ya lo recogieron
    with pytest.raises(SupplyUnavailableError):
        run.claim(999, 11.0)                                              # no existe
    otro = [i for i in run.active(10.0) if i.id != item.id][0]
    with pytest.raises(SupplyUnavailableError):
        run.claim(otro.id, otro.expire_at + CLAIM_GRACE_SECONDS + 0.5)   # vencio


def test_a_pickup_right_at_expiry_is_accepted_thanks_to_the_grace_period():
    run = nueva(maxPorTipo=1)
    item = run.active(10.0)[0]
    assert run.claim(item.id, item.expire_at + CLAIM_GRACE_SECONDS - 0.1)


def test_each_supply_carries_candidate_positions_in_valid_ranges():
    for item in nueva().active(10.0):
        assert len(item.candidates) == SUPPLY_CANDIDATES
        assert all(0 <= a < 6.2832 and 0 <= f <= 1 for a, f in item.candidates)


def test_after_a_long_gap_it_jumps_to_what_is_still_valid_without_looping_for_ages():
    run = nueva()
    activos = run.active(10 * 3600.0)                                    # 10 horas sin consultar
    assert 0 < len(activos) <= 12
    assert all(i.spawn_at > 10 * 3600.0 - 60 - 1 for i in activos)


def test_registry_uses_the_server_clock_and_isolates_runs():
    reloj = RelojFalso()
    registro = SupplyRunRegistry(clock=reloj)
    a, _ = registro.start()
    b, _ = registro.start()
    reloj.t += 10.0
    run_a, elapsed = registro.snapshot(a)
    assert elapsed == 10.0 and len(run_a.active(elapsed)) == 2
    item = run_a.active(elapsed)[0]
    premio = registro.claim(a, item.id)
    assert premio["tipo"] in ("botiquin", "arma")
    run_b, elapsed_b = registro.snapshot(b)
    assert len(run_b.active(elapsed_b)) == 2                              # lo de la carrera A no afecta a la B
    with pytest.raises(SupplyUnavailableError):
        registro.snapshot("no-existe")


def test_registry_drops_idle_runs_and_caps_memory():
    reloj = RelojFalso()
    registro = SupplyRunRegistry(clock=reloj)
    viejo, _ = registro.start()
    reloj.t += 3 * 3600
    registro.start()                                                      # al abrir otra se limpia lo inactivo
    with pytest.raises(SupplyUnavailableError):
        registro.snapshot(viejo)


def test_ledger_tracks_weapons_and_ammo_and_consumes_them():
    ledger = GrantLedger()
    ledger.grant("u1", "pistola", 10)
    ledger.grant("u1", "bate", 0)
    armas, balas = ledger.available("u1")
    assert armas == Counter({"pistola": 1, "bate": 1}) and balas == 10
    ledger.consume("u1", Counter({"pistola": 1}), 4)
    armas, balas = ledger.available("u1")
    assert armas == Counter({"bate": 1}) and balas == 6
    ledger.consume("u1", Counter({"bate": 1}), 6)
    assert ledger.available("u1") == (Counter(), 0)
    assert ledger.available("otro") == (Counter(), 0)

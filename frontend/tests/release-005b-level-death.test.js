import { describe, expect, it, vi, afterEach } from 'vitest';
import { prepararPartida, limpiarPartida } from './helpers/partida.js';

// POL-LEVEL-001: cambiar nivel no reinicia partida, cancela muerte ni revive.
// Se usan las funciones reales de ciclo.js y niveles.js (ver helpers/partida.js); el reloj es falso.
// (El antiguo modo R005B_CANDIDATO aplicaba docs/architecture/release-005b-main.patch sobre main.js;
// ese codigo ya no vive alli y el parche documental no se aplica a los modulos actuales.)
async function preparar({ vida = 85 } = {}) {
  const h = await prepararPartida({ vida });
  return { ...h,
    api: { empezarNivel: h.niveles.empezarNivel, revisarPortal: h.niveles.revisarPortal,
      matarJugador: h.ciclo.matarJugador, pausar: h.ciclo.pausar, leer: h.leer },
    acabarCallbacks: () => h.tick() };
}

afterEach(() => limpiarPartida());

const tick = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

describe('RELEASE-005B POL-LEVEL-001 [CÓDIGO ACTUAL]', () => {
  it('L005B-01: muerte antes de solicitar nivel conserva mundo y progreso', async () => {
    const h = await preparar(); h.api.matarJugador();
    const p = h.api.empezarNivel(1); await h.resolverCargas(); await p;
    expect(h.api.leer().mundo).toBe(h.inicial);
    expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
    expect(h.jugador.vivo).toBe(false);
  });
  it('L005B-02: muerte durante fade-out invalida el callback de transición', async () => {
    const h = await preparar(); h.api.revisarPortal(); h.api.matarJugador();
    await h.avanzar(700); await h.resolverCargas(); await h.acabarCallbacks(); await h.avanzar(800);
    expect(h.api.leer().estado).toBe('derrota');
    expect(h.api.leer().mundo).toBe(h.inicial);
    expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-03: muerte durante carga async no publica el candidato ni revive', async () => {
    const h = await preparar(); const p = h.api.empezarNivel(1); await tick();
    h.api.matarJugador(); await h.resolverCargas(); await p;
    expect(h.jugador.vivo).toBe(false);
    expect(h.api.leer().mundo).toBe(h.inicial);
    expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-04: pausa mantiene deadline 1499/1500 ms de derrota pendiente', async () => {
    const h = await preparar(); h.api.matarJugador(); h.api.pausar();
    await h.avanzar(1499); expect(h.api.leer().estado).toBe('pausa');
    await h.avanzar(1); expect(h.api.leer().estado).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });
  it('L005B-05: carga finalizada después de derrota no altera terminal, vida ni progreso', async () => {
    const h = await preparar(); const p = h.api.empezarNivel(1); await tick();
    h.api.matarJugador(); await h.avanzar(1500);
    await h.resolverCargas(); await p;
    expect(h.api.leer().estado).toBe('derrota'); expect(h.jugador.vivo).toBe(false);
    expect(h.api.leer().mundo).toBe(h.inicial); expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-06: reinicio por reload usa nuevo realm; callback viejo no modifica partida nueva', async () => {
    // main actual reinicia por location.reload: se modelan dos realms, no una API inventada.
    // Entregar artificialmente el callback del realm antiguo prueba aislamiento;
    // no demuestra cancelación de tareas ni navegación real del navegador.
    const anterior = await preparar(); anterior.api.matarJugador();
    const nueva = await preparar(); await anterior.avanzar(1500);
    expect(nueva.jugador.vivo).toBe(true); expect(nueva.api.leer().estado).toBe('jugando');
    expect(nueva.pantallaFinal).not.toHaveBeenCalled(); expect(nueva.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-07: callback de derrota duplicado no repite efectos terminales', async () => {
    const h = await preparar(); const espia = vi.spyOn(globalThis, 'setTimeout'); h.api.matarJugador();
    const callback = espia.mock.calls.find((c) => c[1] === 1500)[0];
    await h.avanzar(1500); callback(); callback();
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1); expect(h.sonido.derrota).toHaveBeenCalledTimes(1);
  });
  it('L005B-08: cambio exitoso con jugador vivo publica nivel una sola vez', async () => {
    const h = await preparar(); const p = h.api.empezarNivel(1);
    await h.resolverCargas(); await p;
    expect(h.api.leer().nivel).toBe(1); expect(h.api.leer().mundo).not.toBe(h.inicial);
    expect(h.api.leer().cambiandoNivel).toBe(false); expect(h.jugador.vivo).toBe(true);
    expect(h.cuenta.guardarNivel).toHaveBeenCalledExactlyOnceWith(1);
  });
  it('L005B-09: carga pendiente conserva vida, pausa, mundo y progreso hasta publicar', async () => {
    const h = await preparar({ vida: 85 }); h.api.pausar();
    const p = h.api.empezarNivel(1); await tick();
    const antes = { ...h.api.leer(), guardados: h.cuenta.guardarNivel.mock.calls.length, vida: h.jugador.vida };
    await h.resolverCargas(); await p;
    expect(antes.estado).toBe('pausa'); expect(antes.vida).toBe(85);
    expect(antes.mundo).toBe(h.inicial); expect(antes.guardados).toBe(0);
    expect(h.api.leer().estado).toBe('pausa'); expect(h.jugador.vida).toBe(85);
  });
  it('L005B-10: solicitud obsoleta no publica recursos, progreso ni mensaje de nivel', async () => {
    const h = await preparar(); const p1 = h.api.empezarNivel(1); await tick();
    const p2 = h.api.empezarNivel(2); await h.resolverCargas(); await Promise.all([p1, p2]);
    expect(h.api.leer().nivel).toBe(2); expect(h.api.leer().mundo.tema.n).toBe(2);
    expect(h.cuenta.guardarNivel.mock.calls).toEqual([[2]]);
    expect(h.decir).not.toHaveBeenCalled();
    expect(h.scene.children).not.toContain(h.cargas[0].mundo.objetos[0]);
  });
});

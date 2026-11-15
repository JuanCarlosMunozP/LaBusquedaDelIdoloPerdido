import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESTADOS, transicionar } from '../src/juego/game-state-machine.js';
import { prepararPartida, limpiarPartida } from './helpers/partida.js';

// El juego esta repartido por responsabilidades: main.js (arranque y bucle), juego/estadoJuego.js (estado),
// juego/ciclo.js (pausa, muerte y fin) y juego/controles.js. Los textos se leen de donde viven hoy.
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const main = leer('../src/main.js');
const estadoJuego = leer('../src/juego/estadoJuego.js');
const ciclo = leer('../src/juego/ciclo.js');

describe('Derrota diferida real (RF-005, ADR-002)', () => {
  afterEach(() => limpiarPartida());

  it('TC-FSM-007: derrota pendiente finaliza después de pausar', async () => {
    // Funciones reales de ciclo.js; solo el navegador, el sonido y la interfaz son dobles.
    const h = await prepararPartida();
    h.g.tiempoFinal = 12.4;
    h.ciclo.matarJugador('impacto');
    expect(h.jugador.vivo).toBe(false);
    expect(h.axelInicial.morir).toHaveBeenCalledWith(undefined, 'impacto');
    expect(h.sonido.derrota).toHaveBeenCalledTimes(1);
    h.ciclo.pausar();
    expect(h.g.estado).toBe('pausa');
    expect(h.hud.pantalla.classList.remove).toHaveBeenCalledWith('oculta');
    await h.avanzar(1499);
    expect(h.g.estado).toBe('pausa');
    expect(h.pantallaFinal).not.toHaveBeenCalled();
    await h.avanzar(1);
    expect(h.g.estado).toBe('derrota');
    expect(h.document.exitPointerLock).toHaveBeenCalledTimes(1);
    expect(h.pantallaFinal).toHaveBeenCalledExactlyOnceWith('derrota', 12, 3);
    // Discrepancia explícita: la FSM aislada aún rechaza derrota desde pausa.
    expect(transicionar(ESTADOS.PAUSA, 'LOSE')).toEqual({
      aceptada: false, estado: ESTADOS.PAUSA,
      motivo: 'TRANSICION_NO_PERMITIDA',
    });
  });
});

describe('Caracterizacion de la FSM actual', () => {
  it('TC-FSM-001: inicia en cargando', () => {
    expect(estadoJuego).toMatch(
      /estado:\s*["']cargando["']/
    );
  });

  it('TC-FSM-002: contempla el estado inicio', () => {
    expect(main).toMatch(
      /g\.estado\s*=\s*["']inicio["']/
    );
  });

  it('TC-FSM-003: implementa una funcion de pausa', () => {
    expect(ciclo).toMatch(
      /function\s+pausar\s*\(\s*\)/
    );
    expect(ciclo).toMatch(
      /g\.estado\s*=\s*["']pausa["']/
    );
  });

  it('TC-FSM-004: reanuda segun la cinematica activa', () => {
    expect(main).toMatch(
      /g\.estado\s*=\s*g\.cine\s*\?\s*["']cinematica["']\s*:\s*["']jugando["']/
    );
  });

  it('TC-FSM-005: permite finalizar una cinematica', () => {
    expect(main).toMatch(
      /g\.cine\s*=\s*null;\s*g\.estado\s*=\s*["']jugando["']/
    );
  });

  it('TC-FSM-006: mantiene el bucle de renderizado', () => {
    expect(main).toContain('requestAnimationFrame(animar)');
    expect(main).toContain('renderer.render(scene, camera)');
  });
});

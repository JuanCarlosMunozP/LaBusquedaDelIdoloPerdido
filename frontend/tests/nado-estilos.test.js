import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ARTICULACIONES } from '../src/personajes/constantes.js';
import { posesHumano } from '../src/personajes/poses.js';
import { Enemigo } from '../src/personajes/enemigo.js';
import { ESTADOS_BASE, POSE_DE_ESTADO, estadoDeNado, crearPesos, actualizarPesos } from '../src/personajes/mezcla.js';

const DT = 1 / 60;

function crearCtx(velocidad, tiempo = 0) {
  const o = Object.fromEntries(ARTICULACIONES.map((n) => [n, [0, 0, 0]]));
  return { o, bob: 0, roll: 0, cabeceo: 0, dt: DT, velocidad, tiempo };
}
const instantanea = (ctx) => ARTICULACIONES.flatMap((n) => ctx.o[n]);

describe('estilos de nado: estados y poses', () => {
  it('todos los estados base tienen una pose definida', () => {
    for (const e of ESTADOS_BASE) expect(typeof posesHumano[POSE_DE_ESTADO[e]], e).toBe('function');
  });

  it('los pesos siguen sumando 1 con los estilos nuevos', () => {
    const pesos = crearPesos();
    for (const e of ['flotar', 'nadoBraza', 'nadoRapido', 'nadoEspalda']) {
      for (let i = 0; i < 90; i++) {
        actualizarPesos(pesos, e, DT);
        expect(ESTADOS_BASE.reduce((s, x) => s + pesos[x], 0)).toBeCloseTo(1, 10);
      }
      expect(pesos[e]).toBeGreaterThan(0.99);
    }
  });

  it.each([['poseFlotar', 0], ['poseNadoBraza', 1], ['poseNadoRapido', 3.4], ['poseNadoEspalda', 2.4]])(
    '%s: valores finitos y sin saltos bruscos entre cuadros', (nombre, velocidad) => {
      const humano = {};
      let previa = null, peor = 0;
      for (let i = 0; i < 600; i++) {
        const ctx = crearCtx(velocidad, 900 + i * DT);
        posesHumano[nombre].call(humano, ctx);
        const actual = instantanea(ctx);
        expect(actual.every(Number.isFinite)).toBe(true);
        expect(Number.isFinite(ctx.bob + ctx.roll + ctx.cabeceo)).toBe(true);
        if (previa) peor = Math.max(peor, ...actual.map((v, k) => Math.abs(v - previa[k])));
        previa = actual;
      }
      expect(peor).toBeLessThan(0.6);
    });

  it('de espaldas el cuerpo se tiende boca arriba y al flotar queda casi vertical', () => {
    const espalda = crearCtx(2.4); posesHumano.poseNadoEspalda.call({}, espalda);
    const flota = crearCtx(0); posesHumano.poseFlotar.call({}, flota);
    const rapido = crearCtx(3.4); posesHumano.poseNadoRapido.call({}, rapido);
    expect(1.45 + espalda.cabeceo).toBeLessThan(-1);     // inclinacion final negativa = boca arriba
    expect(1.45 + flota.cabeceo).toBeLessThan(0.6);      // casi de pie
    expect(flota.bob).toBeLessThan(-0.8);                // hundido hasta el pecho
    expect(1.45 + rapido.cabeceo).toBeGreaterThan(1.4);  // el crol rapido va mas horizontal
  });

  it('el crol rapido braceo mas amplio que el crol normal', () => {
    const amplitud = (nombre) => {
      const humano = {}; let min = Infinity, max = -Infinity;
      for (let i = 0; i < 300; i++) {
        const ctx = crearCtx(3.4, i * DT); posesHumano[nombre].call(humano, ctx);
        min = Math.min(min, ctx.o.hombro_I[0]); max = Math.max(max, ctx.o.hombro_I[0]);
      }
      return max - min;
    };
    expect(amplitud('poseNadoRapido')).toBeGreaterThan(amplitud('poseNado'));
  });
});

describe('estadoDeNado: elige el estilo por velocidad', () => {
  it('flota en el sitio', () => {
    expect(estadoDeNado('mar', 0)).toBe('flotar');
    expect(estadoDeNado('oasis', 0.2)).toBe('flotar');
  });
  it('mar: braza lenta, crol y crol rapido', () => {
    expect(estadoDeNado('mar', 1.0)).toBe('nadoBraza');
    expect(estadoDeNado('mar', 2.4)).toBe('nado');
    expect(estadoDeNado('mar', 3.4)).toBe('nadoRapido');
  });
  it('oasis: braza normal y crol rapido', () => {
    expect(estadoDeNado('oasis', 1.9)).toBe('nadoOasis');
    expect(estadoDeNado('oasis', 2.7)).toBe('nadoRapido');
  });
  it('de espaldas cuando se avanza hacia atras, pero flotando si esta quieto', () => {
    expect(estadoDeNado('mar', 2.4, true)).toBe('nadoEspalda');
    expect(estadoDeNado('oasis', 1.9, true)).toBe('nadoEspalda');
    expect(estadoDeNado('mar', 0.1, true)).toBe('flotar');
  });
  it('la histeresis evita parpadeos en el limite', () => {
    // 2.85 m/s esta justo bajo el umbral del crol rapido (2.9): solo se mantiene si ya iba rapido
    expect(estadoDeNado('mar', 2.85, false, 'nado')).toBe('nado');
    expect(estadoDeNado('mar', 2.85, false, 'nadoRapido')).toBe('nadoRapido');
    expect(estadoDeNado('mar', 0.5, false, 'flotar')).toBe('flotar');
    expect(estadoDeNado('mar', 0.5, false, 'nado')).toBe('nadoBraza');
  });
});

// Mercenario de prueba: la clase real (Enemigo.actualizar) con un mundo y un humano de mentira.
function crearEnemigoDePrueba({ estado = 'persigue', x = 5 } = {}) {
  const altura = (px) => (px >= 10 ? -1 : 0.5);
  const mundo = {
    altura, esAgua: (px, pz) => altura(px, pz) < 0, dentroDelMapa: (px, pz) => Math.hypot(px, pz) < 60, resolver: () => {},
    agua: { tipo: 'mar', velocidad: { nadar: 2.4, rapido: 3.4 }, flotacion: 0.32,
      superficie: () => -0.05, contiene: (px, pz, dentro) => altura(px, pz) < (dentro ? -0.15 : -0.45) },
  };
  const humano = { mirarHacia: vi.fn(), actualizar: vi.fn(), golpear: vi.fn(), armaMalla: null, activo: true, grupo: new THREE.Group() };
  const e = Object.assign(Object.create(Enemigo.prototype), {
    mundo, humano, estado, pos: new THREE.Vector3(x, 0.5, 0), vel: new THREE.Vector2(), empuje: new THREE.Vector2(),
    objetivo: new THREE.Vector2(x, 0), casa: new THREE.Vector2(x, 0), espera: 0, cooldown: 0, nadando: false,
    arma: { tipo: 'cuerpo', alcance: 1.5, espera: 1, dano: 1, rango: 0, distancia: 0 }, fogonazoT: 0, golpeT: -1,
    disparoT: -1, velocidad: 0, balas: [], actualizarBalas: () => {},
  });
  return e;
}
const jugadorEn = (x) => ({ vivo: true, pos: new THREE.Vector3(x, -1, 0) });

describe('mercenarios en el agua', () => {
  it('persiguiendo a Max entran al agua y nadan mas despacio', () => {
    const e = crearEnemigoDePrueba(); const danar = vi.fn();
    for (let i = 0; i < 600; i++) e.actualizar(DT, i * DT, jugadorEn(20), danar, {});
    expect(e.pos.x).toBeGreaterThan(10);
    expect(e.nadando).toBe(true);
    const ultima = e.humano.actualizar.mock.calls.at(-1);
    expect(ultima[5]).toBe('mar');                        // anima con el estilo de nado del mar
    expect(ultima[1]).toBeLessThanOrEqual(1.8);           // y no corre a 3.4 m/s
    expect(e.pos.y).toBeCloseTo(-0.05 - 0.32, 1);         // flota sobre la superficie
  });

  it('patrullando no se mete al agua', () => {
    const e = crearEnemigoDePrueba({ estado: 'patrulla', x: 9 });
    e.objetivo.set(30, 0);                                 // un destino dentro del agua
    for (let i = 0; i < 600; i++) e.actualizar(DT, i * DT, jugadorEn(500), vi.fn(), {});
    expect(e.pos.x).toBeLessThan(10);
    expect(e.nadando).toBe(false);
  });

  it('nadando no ataca aunque Max este al alcance', () => {
    const e = crearEnemigoDePrueba({ x: 12 }); const danar = vi.fn();
    e.nadando = true;
    for (let i = 0; i < 120; i++) e.actualizar(DT, i * DT, jugadorEn(12.5), danar, {});
    expect(e.humano.golpear).not.toHaveBeenCalled();
    expect(danar).not.toHaveBeenCalled();
  });

  it('arranca y frena sin saltos de velocidad', () => {
    const e = crearEnemigoDePrueba({ x: 0 });
    e.actualizar(DT, 0, jugadorEn(-9), vi.fn(), {});       // Max a la vista, el mercenario empieza a perseguir
    e.actualizar(DT, DT, jugadorEn(-9), vi.fn(), {});
    expect(Math.hypot(e.vel.x, e.vel.y)).toBeLessThan(1.7);   // dos cuadros despues de arrancar aun no llega ni a la mitad de 3.4 m/s
    for (let i = 0; i < 60; i++) e.actualizar(DT, i * DT, jugadorEn(-9), vi.fn(), {});
    expect(Math.hypot(e.vel.x, e.vel.y)).toBeGreaterThan(2.5);
  });

  it('al caminar la zancada se anima mas que la velocidad real (pasos visibles, no tiesos)', () => {
    const e = crearEnemigoDePrueba({ estado: 'patrulla', x: 0 });
    e.objetivo.set(-8, 0);
    for (let i = 0; i < 180; i++) e.actualizar(DT, i * DT, jugadorEn(500), vi.fn(), {});
    const real = Math.hypot(e.vel.x, e.vel.y);
    const animada = e.humano.actualizar.mock.calls.at(-1)[1];
    expect(real).toBeCloseTo(1.4, 1);
    expect(animada).toBeGreaterThan(real * 1.3);
  });
});

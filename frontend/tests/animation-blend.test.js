import { describe, expect, it } from 'vitest';
import { ARTICULACIONES } from '../src/personajes/constantes.js';
import { posesHumano } from '../src/personajes/poses.js';
import {
  ESTADOS_BASE, actualizarPesos, avanzarFase, crearPesos
} from '../src/personajes/mezcla.js';

const DT = 1 / 60;

function crearCtx(velocidad, dt = DT, tiempo = 0) {
  const o = Object.fromEntries(ARTICULACIONES.map((n) => [n, [0, 0, 0]]));
  return { o, bob: 0, dt, velocidad, tiempo };
}

const instantanea = (ctx) => ARTICULACIONES.flatMap((n) => ctx.o[n]);
const saltoMaximo = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

describe('mezcla de poses base', () => {
  it('arranca en reposo con suma 1', () => {
    const pesos = crearPesos();
    expect(pesos.reposo).toBe(1);
    expect(ESTADOS_BASE.reduce((s, e) => s + pesos[e], 0)).toBeCloseTo(1, 10);
  });

  it('mantiene la suma en 1 y converge al estado activo', () => {
    const pesos = crearPesos();
    for (let i = 0; i < 120; i++) {
      actualizarPesos(pesos, 'caminar', DT);
      expect(ESTADOS_BASE.reduce((s, e) => s + pesos[e], 0)).toBeCloseTo(1, 10);
    }
    expect(pesos.caminar).toBeGreaterThan(0.99);
  });

  it('no salta de golpe: en un cuadro el cambio es pequeño', () => {
    const pesos = crearPesos();
    actualizarPesos(pesos, 'nado', DT);
    expect(pesos.nado).toBeLessThan(0.2);
    expect(pesos.reposo).toBeGreaterThan(0.8);
  });

  it('no depende de los cuadros por segundo', () => {
    const a = crearPesos(), b = crearPesos();
    for (let i = 0; i < 60; i++) actualizarPesos(a, 'aire', 1 / 60);   // 1 s a 60 fps
    for (let i = 0; i < 20; i++) actualizarPesos(b, 'aire', 1 / 20);   // 1 s a 20 fps
    expect(a.aire).toBeCloseTo(b.aire, 6);
  });

  it('un dt de cero no cambia nada', () => {
    const pesos = crearPesos();
    actualizarPesos(pesos, 'nado', 0);
    expect(pesos.reposo).toBe(1);
  });
});

describe('fase acumulada', () => {
  it('se mantiene en [0, 2π)', () => {
    let fase = 0;
    for (let i = 0; i < 5000; i++) {
      fase = avanzarFase(fase, DT, 4.8);
      expect(fase).toBeGreaterThanOrEqual(0);
      expect(fase).toBeLessThan(Math.PI * 2);
    }
  });

  it('un cambio de frecuencia no altera la fase actual', () => {
    const antes = avanzarFase(1.234, 0, 3.2);
    const despues = avanzarFase(1.234, 0, 4.8);
    expect(despues).toBeCloseTo(antes, 12);
  });

  it('acepta una fase indefinida', () => {
    expect(avanzarFase(undefined, 0.5, 2)).toBeCloseTo(1, 12);
  });
});

// Regresion: antes la brazada era `tiempo * frecuencia`, asi que al cambiar la velocidad la
// fase saltaba cientos de radianes y los brazos "teletransportaban".
describe('nado sin saltos al cambiar de velocidad', () => {
  it.each([
    ['poseNado', [0.5, 3.2]],
    ['poseNadoOasis', [0.3, 1.9]]
  ])('%s: la velocidad sube de lenta a rapida con tiempo global alto', (nombre, [lenta, rapida]) => {
    const humano = {};
    const tiempo = 800;                      // un rato jugando: `tiempo * frecuencia` ya seria enorme
    let previa = null, peor = 0;
    for (let i = 0; i < 240; i++) {
      // en el juego la velocidad sube suavemente (~0.3 s), no de golpe
      const velocidad = lenta + (rapida - lenta) * Math.min(1, Math.max(0, (i - 100) / 20));
      const ctx = crearCtx(velocidad, DT, tiempo + i * DT);
      posesHumano[nombre].call(humano, ctx);
      const actual = instantanea(ctx);
      if (previa) peor = Math.max(peor, saltoMaximo(previa, actual));
      previa = actual;
    }
    expect(peor).toBeLessThan(0.6);   // rad entre cuadros consecutivos (antes superaba 1 rad)
  });

  it('la brazada avanza por cuadros, sin depender del tiempo global', () => {
    const humano = {};
    const ctx1 = crearCtx(2.5, DT, 10);
    posesHumano.poseNado.call(humano, ctx1);
    const humano2 = {};
    const ctx2 = crearCtx(2.5, DT, 99999);
    posesHumano.poseNado.call(humano2, ctx2);
    expect(humano2.faseNado).toBeCloseTo(humano.faseNado, 12);
  });
});

// Fase 2: el cuerpo entero se balancea, se inclina y sube y baja al nadar.
describe('nado: balanceo, cabeceo y vaivén del cuerpo', () => {
  const cuadros = (nombre, velocidad, n = 240) => {
    const humano = {};
    const salida = [];
    for (let i = 0; i < n; i++) {
      const ctx = crearCtx(velocidad, DT, 50 + i * DT);
      ctx.roll = 0; ctx.cabeceo = 0;
      posesHumano[nombre].call(humano, ctx);
      salida.push({ roll: ctx.roll, cabeceo: ctx.cabeceo, bob: ctx.bob });
    }
    return salida;
  };

  it.each([['poseNado', 0], ['poseNado', 1.5], ['poseNado', 3.4], ['poseNadoOasis', 0], ['poseNadoOasis', 1.9]])(
    '%s a %s m/s: valores acotados y finitos', (nombre, v) => {
      for (const c of cuadros(nombre, v)) {
        expect(Number.isFinite(c.roll + c.cabeceo + c.bob)).toBe(true);
        expect(Math.abs(c.roll)).toBeLessThanOrEqual(0.2);
        expect(c.cabeceo).toBeGreaterThanOrEqual(-0.2);
        expect(c.cabeceo).toBeLessThanOrEqual(0.05);
        expect(Math.abs(c.bob)).toBeLessThanOrEqual(0.05);
      }
    });

  it('el balanceo oscila a ambos lados con la brazada (no queda fijo)', () => {
    const r = cuadros('poseNado', 3).map((c) => c.roll);
    expect(Math.max(...r)).toBeGreaterThan(0.05);
    expect(Math.min(...r)).toBeLessThan(-0.05);
  });

  it('sin avanzar queda mas vertical que nadando fuerte', () => {
    const quieto = cuadros('poseNado', 0).map((c) => c.cabeceo);
    const fuerte = cuadros('poseNado', 3).map((c) => c.cabeceo);
    const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(media(quieto)).toBeLessThan(media(fuerte));
  });

  it('roll, cabeceo y bob cambian de forma continua entre cuadros', () => {
    const c = cuadros('poseNado', 3);
    for (let i = 1; i < c.length; i++) {
      expect(Math.abs(c[i].roll - c[i - 1].roll)).toBeLessThan(0.05);
      expect(Math.abs(c[i].cabeceo - c[i - 1].cabeceo)).toBeLessThan(0.05);
      expect(Math.abs(c[i].bob - c[i - 1].bob)).toBeLessThan(0.02);
    }
  });

  it('las poses que no son de nado no tocan roll ni cabeceo', () => {
    for (const nombre of ['poseReposo', 'poseCaminar', 'poseAire']) {
      const ctx = crearCtx(2);
      ctx.roll = 0; ctx.cabeceo = 0;
      ctx.A = 0.6; ctx.s = 0.3; ctx.c = 0.9; ctx.corre = 0; ctx.velocidadVertical = 0;
      posesHumano[nombre].call({}, ctx);
      expect(ctx.roll).toBe(0);
      expect(ctx.cabeceo).toBe(0);
    }
  });
});

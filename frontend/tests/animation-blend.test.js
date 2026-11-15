import { describe, expect, it } from 'vitest';
import { ARTICULACIONES, DURACION_GOLPE, INSTANTE_IMPACTO } from '../src/personajes/constantes.js';
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

// Fase 3: variedad (reposo, inclinacion al girar, arranque/frenado y aterrizaje).
const semilla = (n) => () => ((n = (n * 1664525 + 1013904223) % 4294967296) / 4294967296);

function ctxMarcha({ giro = 0, accel = 0, A = 0.8, corre = 0, fase = 0.5 } = {}) {
  const ctx = crearCtx(2.5);
  Object.assign(ctx, { giro, accel, A, corre, s: Math.sin(fase), c: Math.cos(fase) });
  return ctx;
}

describe('reposo con variantes', () => {
  const correr = (azar, segundos, onCuadro) => {
    const humano = { azar };
    for (let i = 0; i < segundos * 60; i++) {
      const ctx = crearCtx(0, DT, i * DT);
      posesHumano.poseReposo.call(humano, ctx);
      onCuadro(ctx, humano, i);
    }
    return humano;
  };

  it('aparecen las cuatro variantes y ninguna se repite dos veces seguidas', () => {
    const vistas = [];
    correr(semilla(7), 240, (_c, h) => {
      const t = h.varianteReposo.tipo;
      if (t && vistas[vistas.length - 1] !== t) vistas.push(t);
    });
    expect(new Set(vistas)).toEqual(new Set(['peso', 'mirar', 'respiro', 'curioso']));
    for (let i = 1; i < vistas.length; i++) expect(vistas[i]).not.toBe(vistas[i - 1]);
  });

  it('es continuo entre cuadros y acotado', () => {
    let previa = null;
    correr(semilla(3), 120, (ctx) => {
      const actual = instantanea(ctx);
      expect(actual.every(Number.isFinite)).toBe(true);
      expect(Math.max(...actual.map(Math.abs))).toBeLessThan(1.2);
      if (previa) expect(saltoMaximo(previa, actual)).toBeLessThan(0.06);
      previa = actual;
    });
  });

  it('al terminar cada variante vuelve a la pose basica', () => {
    for (const tipo of ['peso', 'mirar', 'respiro', 'curioso']) {
      const humano = { azar: () => 0.5, varianteReposo: { tipo, t: 0, dur: 2, lado: 1, espera: 0, ultimo: tipo } };
      let enMedio = 0, ctx;
      for (let i = 0; i < 4 * 60; i++) {
        ctx = crearCtx(0, DT, 0);                       // tiempo fijo: aisla la variante de la respiracion
        posesHumano.poseReposo.call(humano, ctx);
        if (humano.varianteReposo.tipo === tipo) enMedio = Math.max(enMedio, ...instantanea(ctx).map(Math.abs));
      }
      expect(humano.varianteReposo.tipo).toBeNull();      // termino y esta esperando la siguiente
      const base = crearCtx(0, DT, 0);
      posesHumano.poseReposo.call({ azar: () => 0.5, varianteReposo: { tipo: null, t: 0, dur: 0, lado: 1, espera: 99, ultimo: null } }, base);
      expect(saltoMaximo(instantanea(ctx), instantanea(base))).toBeLessThan(1e-9);
      expect(enMedio).toBeGreaterThan(0.1);                // y durante la variante si se movio
    }
  });

  it('las dos opciones de lado producen variantes simetricas', () => {
    const peso = (lado) => {
      const h = { varianteReposo: { tipo: 'peso', t: 1.6, dur: 3.2, lado, espera: 0, ultimo: 'peso' } };
      const ctx = crearCtx(0, 0, 0);
      posesHumano.poseReposo.call(h, ctx);
      return ctx.o;
    };
    const d = peso(1), i = peso(-1);
    expect(d.torso[2]).toBeGreaterThan(0.05);
    expect(i.torso[2]).toBeLessThan(-0.05);
    expect(d.rodilla_I[0]).toBeGreaterThan(0.2);     // lado +1: apoya la derecha, relaja la izquierda
    expect(i.rodilla_D[0]).toBeGreaterThan(0.2);
  });
});

describe('inclinacion al girar y al arrancar o frenar', () => {
  const marcha = (opc) => { const ctx = ctxMarcha(opc); posesHumano.poseCaminar.call({}, ctx); return ctx.o; };

  it('sin giro ni aceleracion no se inclina de mas', () => {
    const a = marcha({}), b = marcha({ giro: 0, accel: 0 });
    expect(b.torso[2]).toBeCloseTo(a.torso[2], 12);
    expect(Math.abs(a.torso[2])).toBeLessThan(1e-9);
  });

  it('girar a la izquierda (giro > 0) inclina el torso a la izquierda, y a la derecha lo contrario', () => {
    expect(marcha({ giro: 4 }).torso[2]).toBeLessThan(-0.05);   // -Z = izquierda del personaje
    expect(marcha({ giro: -4 }).torso[2]).toBeGreaterThan(0.05);
  });

  it('la cabeza compensa en sentido contrario al torso', () => {
    const o = marcha({ giro: 4 });
    expect(Math.sign(o.cabeza[2])).toBe(-Math.sign(o.torso[2]));
    expect(Math.abs(o.cabeza[2])).toBeLessThan(Math.abs(o.torso[2]));
  });

  it('acelerar echa el torso adelante y frenar lo echa atras', () => {
    const base = marcha({}).torso[0];
    expect(marcha({ accel: 8 }).torso[0]).toBeGreaterThan(base + 0.05);
    expect(marcha({ accel: -8 }).torso[0]).toBeLessThan(base - 0.05);
  });

  it('esta acotada aunque el giro o la aceleracion sean exagerados', () => {
    const o = marcha({ giro: 999, accel: 999 }), base = marcha({});
    expect(Math.abs(o.torso[2])).toBeLessThanOrEqual(0.2);
    expect(o.torso[0] - base.torso[0]).toBeLessThanOrEqual(0.121);
  });

  it('casi sin velocidad (A pequena) apenas se inclina', () => {
    expect(Math.abs(marcha({ giro: 8, A: 0.06 }).torso[2])).toBeLessThan(0.01);
  });
});

describe('aterrizaje segun la caida', () => {
  const rodilla = (fuerza) => {
    const ctx = crearCtx(0, DT);
    posesHumano.ajusteAterrizaje.call({ impactoAterrizaje: 0.18, fuerzaAterrizaje: fuerza }, ctx);
    return ctx.o.rodilla_I[0];
  };

  it('una caida mas fuerte flexiona mas las rodillas', () => {
    expect(rodilla(1.6)).toBeGreaterThan(rodilla(1));
    expect(rodilla(1)).toBeGreaterThan(rodilla(0.5));
  });

  it('sin dato de fuerza se comporta como antes (1)', () => {
    const ctx = crearCtx(0, DT);
    posesHumano.ajusteAterrizaje.call({ impactoAterrizaje: 0.18 }, ctx);
    expect(ctx.o.rodilla_I[0]).toBeCloseTo(rodilla(1), 12);
  });
});

// Fase 4: combate, daño y heridas.
describe('golpe: los tiempos de combate no cambian', () => {
  const golpe = (brazo, p) => {
    const ctx = crearCtx(0, DT);
    ctx.punoObj = { I: 0.3, D: 0.3 };
    posesHumano.poseGolpe.call({ brazoGolpe: brazo, golpeT: 0, congelarGolpe: p }, ctx);
    return ctx.o;
  };

  it('las constantes de combate siguen siendo 0.5 s y 0.25 s', () => {
    expect(DURACION_GOLPE).toBe(0.5);
    expect(INSTANTE_IMPACTO).toBe(0.25);
  });

  it('el brazo esta totalmente extendido justo en el instante de impacto', () => {
    const p = INSTANTE_IMPACTO / DURACION_GOLPE;       // fraccion del golpe en la que conecta el daño
    expect(golpe('D', p).hombro_D[0]).toBeCloseTo(-1.52, 6);
    expect(golpe('I', p).hombro_I[0]).toBeCloseTo(-1.52, 6);
  });

  it('las caderas rotan con el golpe, en el mismo sentido que el torso pero menos', () => {
    for (const [brazo, signo] of [['D', 1], ['I', -1]]) {
      const o = golpe(brazo, 0.5);
      expect(Math.sign(o.cadera[1])).toBe(signo);
      expect(Math.sign(o.torso[1])).toBe(signo);
      expect(Math.abs(o.cadera[1])).toBeLessThan(Math.abs(o.torso[1]));
    }
  });

  it('es finito y continuo durante todo el golpe', () => {
    let previa = null;
    for (let i = 0; i <= 100; i++) {
      const actual = instantanea({ o: golpe('D', i / 100) });
      expect(actual.every(Number.isFinite)).toBe(true);
      if (previa) expect(saltoMaximo(previa, actual)).toBeLessThan(0.5);
      previa = actual;
    }
  });
});

describe('reaccion al recibir un golpe', () => {
  const reaccion = (empuje, transcurrido, direccion = 0) => {
    const dur = 0.2;
    const ctx = crearCtx(0, 0);                            // dt = 0: se fija el instante exacto
    const humano = { destelloT: dur - transcurrido, destelloDur: dur, destelloEmpuje: empuje, direccion, mats: [] };
    posesHumano.poseDestello.call(humano, ctx);
    return ctx.o;
  };

  it('empieza suave: en el primer instante casi no se mueve', () => {
    expect(Math.abs(reaccion({ x: 0, z: -1 }, 0).torso[0])).toBeLessThan(1e-9);
    expect(Math.abs(reaccion(null, 0).torso[0])).toBeLessThan(1e-9);
  });

  it('llega a su maximo rapido (~0.04 s) y vuelve a cero al terminar', () => {
    const pico = Math.abs(reaccion(null, 0.04).torso[0]);
    expect(pico).toBeCloseTo(0.3, 6);
    expect(Math.abs(reaccion(null, 0.2).torso[0])).toBeLessThan(1e-9);
    expect(Math.abs(reaccion({ x: 1, z: 0 }, 0.2).torso[2])).toBeLessThan(1e-9);
  });

  it('de frente echa el torso atras y de espaldas lo dobla hacia adelante', () => {
    // el personaje mira a +Z (direccion 0): un golpe de frente lo empuja hacia -Z
    const frente = reaccion({ x: 0, z: -1 }, 0.04), espalda = reaccion({ x: 0, z: 1 }, 0.04);
    expect(frente.torso[0]).toBeLessThan(0);
    expect(espalda.torso[0]).toBeGreaterThan(0.25);
    expect(frente.cabeza[0]).toBeLessThan(espalda.cabeza[0]);   // la cabeza se echa mas atras de frente
  });

  it('de lado se inclina hacia donde lo empujan', () => {
    // +X es la izquierda del personaje (mira a +Z), y torso[2] negativo = inclinarse a la izquierda
    expect(reaccion({ x: 1, z: 0 }, 0.04).torso[2]).toBeLessThan(-0.1);
    expect(reaccion({ x: -1, z: 0 }, 0.04).torso[2]).toBeGreaterThan(0.1);
  });

  it('respeta hacia donde mira el personaje', () => {
    // mirando a +X (direccion = π/2), un empuje hacia -X es "de frente"
    const frente = reaccion({ x: -1, z: 0 }, 0.04, Math.PI / 2);
    expect(frente.torso[0]).toBeLessThan(0);
    expect(Math.abs(frente.torso[2])).toBeLessThan(1e-6);
  });

  it('es continua entre cuadros y acotada', () => {
    let previa = null;
    for (let i = 0; i <= 12; i++) {
      const actual = instantanea({ o: reaccion({ x: 0.6, z: -0.8 }, i * DT) });
      expect(Math.max(...actual.map(Math.abs))).toBeLessThan(0.6);
      if (previa) expect(saltoMaximo(previa, actual)).toBeLessThan(0.3);
      previa = actual;
    }
  });
});

describe('herida', () => {
  it('entra de forma gradual y no se pasa de rango', () => {
    const o = (t) => {
      const ctx = crearCtx(0, 0); ctx.A = 0; ctx.s = 0;
      posesHumano.poseHerida.call({ herida: { parte: 'abdomen', lado: 'D', t, dur: 2.8 } }, ctx);
      return ctx.o;
    };
    const t0 = Math.abs(o(0).torso[0]), t15 = Math.abs(o(0.15).torso[0]), t30 = Math.abs(o(0.3).torso[0]);
    expect(t0).toBeLessThan(t15);                 // a los 0.15 s aun no esta a pleno
    expect(t15).toBeLessThan(t30);
    expect(t30).toBeGreaterThan(0.45);            // y a los 0.3 s ya sostiene la herida
    for (const parte of ['abdomen', 'brazo', 'pierna', 'rodilla']) {
      const ctx = crearCtx(0, 0); ctx.A = 0.5; ctx.s = 0.5;
      posesHumano.poseHerida.call({ herida: { parte, lado: 'I', t: 1, dur: 3 } }, ctx);
      expect(instantanea(ctx).every(Number.isFinite)).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { ARTICULACIONES } from '../src/personajes/constantes.js';
import { posesHumano } from '../src/personajes/poses.js';

const DT = 1 / 60;
function crearCtx(velocidad, tiempo, nadando = "oasis") {
  const o = Object.fromEntries(ARTICULACIONES.map((n) => [n, [0, 0, 0]]));
  return { o, bob: 0, roll: 0, cabeceo: 0, dt: DT, velocidad, tiempo, nadando };
}
const finito = (ctx) => ARTICULACIONES.every((n) => ctx.o[n].every(Number.isFinite)) && Number.isFinite(ctx.bob);

// Corre `segundos` de pose y devuelve el rango (max - min) que recorre una articulacion
function rango(pose, nadando, velocidad, segundos, junta, eje) {
  const humano = {};
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < segundos / DT; i++) {
    const ctx = crearCtx(velocidad, i * DT, nadando);
    pose.call(humano, ctx);
    expect(finito(ctx)).toBe(true);
    min = Math.min(min, ctx.o[junta][eje]); max = Math.max(max, ctx.o[junta][eje]);
  }
  return max - min;
}

describe('oasis: nado con variedad', () => {
  it('flotar en el oasis cambia de gesto con el tiempo y en el mar sigue igual', () => {
    expect(rango(posesHumano.poseFlotar, 'oasis', 0, 20, 'hombro_I', 2)).toBeGreaterThan(0.3);   // la apertura de brazos varia entre gestos
    const mar = (t) => { const c = crearCtx(0, t, 'mar'); posesHumano.poseFlotar.call({}, c); return c.o.hombro_I[2]; };
    expect(mar(0)).toBeCloseTo(0.85 + 0.2, 2);     // el mar conserva su pose original (cos ~ 1 en el primer cuadro)
  });

  it('cada brazada de braza sale distinta (amplitud y planeo)', () => {
    const humano = {};
    const picos = new Set();
    let ultimo = -1;
    for (let i = 0; i < 12 / DT; i++) {
      const c = crearCtx(1.5, i * DT);
      posesHumano.poseNadoOasis.call(humano, c);
      if (humano.brazadaOasis !== ultimo) { ultimo = humano.brazadaOasis; picos.add(+humano.fuerzaBrazada?.toFixed(3)); }
    }
    expect(picos.size).toBeGreaterThan(3);
  });
});

describe('escena final: Max sentado', () => {
  it('sentado dobla caderas y rodillas y alterna entre calentarse y descansar', () => {
    const c = crearCtx(0, 0, false);
    posesHumano.poseSentado.call({}, c);
    expect(c.o.muslo_I[0]).toBeLessThan(-1.3);
    expect(c.o.rodilla_D[0]).toBeGreaterThan(1.3);
    expect(rango(posesHumano.poseSentado, false, 0, 25, 'hombro_I', 0)).toBeGreaterThan(0.5);   // los brazos no quedan fijos
    expect(rango(posesHumano.poseSentado, false, 0, 25, 'cabeza', 1)).toBeGreaterThan(0.1);     // mira alrededor
  });
});

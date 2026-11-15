import { describe, expect, it } from 'vitest';
import { mezclaSuelo } from '../src/escenario/texturas.js';

const isla = { tipo: 'isla', desfase: 0 };

describe('mezcla de arena y tierra del suelo', () => {
  it('isla: todo el centro es tierra y la arena queda solo en la orilla, sin depender de la altura', () => {
    for (const [x, z] of [[0, 0], [10, 5], [-15, 12], [0, -20]]) {
      for (const h of [-1, 0.2, 1.5, 3]) expect(mezclaSuelo(x, z, h, isla)).toBe(1);
    }
    for (const [x, z] of [[40, 0], [0, -45], [-38, 20]]) expect(mezclaSuelo(x, z, 0.5, isla)).toBe(0);
  });

  it('isla: entre el centro y la orilla la mezcla es gradual', () => {
    const m = mezclaSuelo(30, 0, 1, isla);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(1);
  });

  it('desierto y montaña: tambien tierra en el centro y arena solo en la orilla', () => {
    for (const tipo of ['desierto', 'montana']) {
      const tema = { tipo, desfase: 3 };
      for (const h of [0, 2, 10]) expect(mezclaSuelo(5, 5, h, tema)).toBe(1);
      expect(mezclaSuelo(56, 0, 2, tema)).toBe(0);
      const medio = mezclaSuelo(46, 0, 2, tema);
      expect(medio).toBeGreaterThan(0);
      expect(medio).toBeLessThan(1);
    }
  });
});

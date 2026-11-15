import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as constantes from '../src/personajes/constantes.js';
import { REGLAS_POR_DEFECTO, aplicarReglas, cargarReglas, reglas } from '../src/juego/reglas.js';
import { ARMAS, zonaDeBala } from '../src/personajes/armas.js';

const copia = () => structuredClone(REGLAS_POR_DEFECTO);

afterEach(() => { vi.useRealTimers(); aplicarReglas(copia(), ARMAS); });   // deja todo como estaba

describe('reglas fijas del juego (las manda el servidor)', () => {
  it('los valores por defecto son los de siempre', () => {
    expect(constantes.DURACION_GOLPE).toBe(0.5);
    expect(constantes.INSTANTE_IMPACTO).toBe(0.25);
    expect(ARMAS.bate.dano).toBe(14);
    expect(zonaDeBala(1.0).dano).toBe(20);
  });

  it('la copia local no se desvia de backend/app/domain/game_rules.py', () => {
    // lee las constantes del servidor tal cual estan escritas en Python y las compara
    const py = readFileSync(resolve(import.meta.dirname, '../../backend/app/domain/game_rules.py'), 'utf8');
    const numero = (clave, bloque = py) => Number(new RegExp(`"${clave}":\\s*([0-9.]+)`).exec(bloque)?.[1]);
    expect(numero('duracionGolpe')).toBe(REGLAS_POR_DEFECTO.combate.duracionGolpe);
    expect(numero('instanteImpacto')).toBe(REGLAS_POR_DEFECTO.combate.instanteImpacto);
    for (const [id, r] of Object.entries(REGLAS_POR_DEFECTO.armas)) {
      const linea = py.split('\n').find((l) => l.includes(`"${id}": {`));
      expect(linea, id).toBeTruthy();
      for (const campo of ['alcance', 'dano', 'golpeEnemigo', 'espera']) expect(numero(campo, linea), `${id}.${campo}`).toBe(r[campo]);
    }
    for (const [k, v] of Object.entries(REGLAS_POR_DEFECTO.suministros)) expect(numero(k), `suministros.${k}`).toBe(v);
    for (const [k, v] of Object.entries(REGLAS_POR_DEFECTO.balas.umbrales)) expect(numero(k), `umbral ${k}`).toBe(v);
    const bloqueDano = /"dano":\s*\{\s*"brazo"[^}]*\}/.exec(py)[0];
    for (const [k, v] of Object.entries(REGLAS_POR_DEFECTO.balas.dano)) expect(numero(k, bloqueDano), `bala ${k}`).toBe(v);
  });

  it('aplicar las reglas del servidor cambia lo que usan los demas modulos', () => {
    const r = copia();
    r.combate = { duracionGolpe: 0.8, instanteImpacto: 0.4 };
    r.armas.bate.dano = 20;
    r.balas.dano.abdomen = 33;
    r.suministros.cada = 5;
    expect(aplicarReglas(r, ARMAS)).toBe(true);
    expect(constantes.DURACION_GOLPE).toBe(0.8);       // los modulos que lo importan ven el valor nuevo
    expect(constantes.INSTANTE_IMPACTO).toBe(0.4);
    expect(ARMAS.bate.dano).toBe(20);
    expect(zonaDeBala(1.0).dano).toBe(33);
    expect(reglas.suministros.cada).toBe(5);
  });

  it('descarta datos imposibles sin lanzar ni dejar el juego a medias', () => {
    const r = copia();
    r.combate = { duracionGolpe: 0.5, instanteImpacto: 0.9 };          // el impacto caeria despues del golpe
    r.armas.bate.alcance = -3;
    r.armas.bate.dano = 'mucho';
    r.armas.bazuca = { alcance: 9, dano: 9, golpeEnemigo: 9, espera: 9 };
    r.suministros.cada = NaN;
    aplicarReglas(r, ARMAS);
    expect(constantes.DURACION_GOLPE).toBe(0.5);
    expect(constantes.INSTANTE_IMPACTO).toBe(0.25);
    expect(ARMAS.bate.alcance).toBe(2.1);
    expect(ARMAS.bate.dano).toBe(14);
    expect(ARMAS.bazuca).toBeUndefined();
    expect(reglas.suministros.cada).toBe(10);
    for (const basura of [null, undefined, 'x', 3, []]) expect(() => aplicarReglas(basura, ARMAS)).not.toThrow();
  });

  it('cargarReglas aplica lo que responde el servidor', async () => {
    const r = copia(); r.armas.cuchillo.dano = 12;
    expect(await cargarReglas(ARMAS, { cargar: async () => ({ ok: true, datos: r }) })).toBe(true);
    expect(ARMAS.cuchillo.dano).toBe(12);
  });

  it('si el servidor falla, rechaza o se cuelga, el juego sigue con las reglas por defecto', async () => {
    expect(await cargarReglas(ARMAS, { cargar: async () => ({ ok: false, status: 503 }) })).toBe(false);
    expect(await cargarReglas(ARMAS, { cargar: async () => { throw new Error('caido'); } })).toBe(false);
    vi.useFakeTimers();
    const colgado = cargarReglas(ARMAS, { cargar: () => new Promise(() => {}), espera: 4000 });
    await vi.advanceTimersByTimeAsync(4001);
    expect(await colgado).toBe(false);
    expect(constantes.DURACION_GOLPE).toBe(0.5);
  });
});

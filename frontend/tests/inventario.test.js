import { describe, expect, it } from 'vitest';
import { crearInventario, MAX_MOCHILA } from '../src/juego/inventario.js';

const memoria = (inicial = {}) => {
  const d = { ...inicial };
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d };
};
const CON = { tiene: true, permitido: true };

const bate = { id: 'bate', tipo: 'cuerpo' };
const pistola = { id: 'pistola', tipo: 'pistola' };
const cuchillo = { id: 'cuchillo', tipo: 'cuerpo' };

describe('inventario: mochila de armas', () => {
  it('guardar el arma de la mano la mueve a la mochila y deja los puños', () => {
    const inv = crearInventario(memoria()), j = { arma: pistola, municion: 7 };
    expect(inv.guardarEnMano(j)).toBe(true);
    expect(j).toEqual({ arma: null, municion: 0 });
    expect(inv.mochila).toEqual([{ arma: pistola, municion: 7 }]);
  });

  it('sin arma no hay nada que guardar', () => {
    const inv = crearInventario(memoria());
    expect(inv.guardarEnMano({ arma: null, municion: 0 })).toBe(false);
    expect(inv.mochila).toHaveLength(0);
  });

  it('cambiar intercambia mano y mochila conservando las balas', () => {
    const inv = crearInventario(memoria()), j = { arma: pistola, municion: 4 };
    inv.mochila.push({ arma: bate, municion: 0 });
    expect(inv.cambiarArma(j, 0)).toBe(true);
    expect(j).toEqual({ arma: bate, municion: 0 });
    expect(inv.mochila).toEqual([{ arma: pistola, municion: 4 }]);
  });

  it('con los puños, sacar un arma la quita de la mochila', () => {
    const inv = crearInventario(memoria()), j = { arma: null, municion: 0 };
    inv.mochila.push({ arma: bate, municion: 0 });
    inv.cambiarArma(j, 0);
    expect(j.arma).toBe(bate);
    expect(inv.mochila).toHaveLength(0);
  });

  it('un indice inexistente no cambia nada', () => {
    const inv = crearInventario(memoria()), j = { arma: bate, municion: 0 };
    expect(inv.cambiarArma(j, 2)).toBe(false);
    expect(j.arma).toBe(bate);
  });

  it('la mochila tiene limite: guardar a mano no la desborda y recoger pierde la mas vieja', () => {
    const inv = crearInventario(memoria());
    for (const a of [bate, pistola, cuchillo]) inv.guardarActual({ arma: a, municion: 1 });
    expect(inv.mochila).toHaveLength(MAX_MOCHILA);
    expect(inv.guardarEnMano({ arma: bate, municion: 0 })).toBe(false);
    inv.guardarActual({ arma: bate, municion: 0 });
    expect(inv.mochila).toHaveLength(MAX_MOCHILA);
    expect(inv.mochila[0].arma).toBe(pistola);
  });
});

describe('inventario: sombrero', () => {
  it('por defecto lo lleva puesto una vez que lo tiene', () => {
    expect(crearInventario(memoria()).modoSombrero(CON)).toBe('cabeza');
  });

  it('antes de la cinematica lo lleva en la mano y donde no se permite, oculto', () => {
    const inv = crearInventario(memoria());
    expect(inv.modoSombrero({ tiene: false, permitido: true })).toBe('mano');
    expect(inv.modoSombrero({ tiene: true, permitido: false })).toBe('oculto');
    expect(inv.modoSombrero({ tiene: false, permitido: false })).toBe('oculto');
  });

  it('guardado se queda guardado en cualquier nivel y llamada (nunca reaparece solo)', () => {
    const inv = crearInventario(memoria());
    inv.fijarSombrero('guardado');
    for (let i = 0; i < 100; i++) expect(inv.modoSombrero(CON)).toBe('oculto');
  });

  it('el bug de la muerte: guardado + morir + recargar sigue guardado', () => {
    const m = memoria();
    crearInventario(m).fijarSombrero('guardado');
    const trasRecargar = crearInventario(m);          // location.reload() crea todo de nuevo
    expect(trasRecargar.sombrero).toBe('guardado');
    expect(trasRecargar.modoSombrero(CON)).toBe('oculto');
  });

  it('puesto tambien persiste, y alternar cambia entre ambos', () => {
    const m = memoria();
    const inv = crearInventario(m);
    expect(inv.alternarSombrero()).toBe('guardado');
    expect(inv.alternarSombrero()).toBe('puesto');
    expect(crearInventario(m).sombrero).toBe('puesto');
  });

  it('ignora estados invalidos y datos corruptos', () => {
    const inv = crearInventario(memoria());
    expect(inv.fijarSombrero('volando')).toBe('puesto');
    expect(crearInventario(memoria({ 'idolo.inventario.v1': '{{no json' })).sombrero).toBe('puesto');
    expect(crearInventario(memoria({ 'idolo.inventario.v1': '{"sombrero":"x"}' })).sombrero).toBe('puesto');
  });

  it('funciona sin almacenamiento (modo privado) y si guardar lanza error', () => {
    expect(crearInventario(null).alternarSombrero()).toBe('guardado');
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
    const inv = crearInventario(roto);
    expect(() => inv.fijarSombrero('guardado')).not.toThrow();
    expect(inv.modoSombrero(CON)).toBe('oculto');
  });
});

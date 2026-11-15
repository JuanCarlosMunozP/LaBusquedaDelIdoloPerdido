import { describe, expect, it } from 'vitest';
import { crearInventario } from '../src/juego/inventario.js';

const memoria = (inicial = {}) => {
  const d = { ...inicial };
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d };
};
const CON = { tiene: true, permitido: true };

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

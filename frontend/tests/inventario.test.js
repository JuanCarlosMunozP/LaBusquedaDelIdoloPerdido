import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it('por defecto lo lleva guardado (ponerselo es opcional) y, si se lo pone, va en la cabeza', () => {
    const inv = crearInventario(memoria());
    expect(inv.sombrero).toBe('guardado');
    expect(inv.modoSombrero(CON)).toBe('oculto');
    inv.fijarSombrero('puesto');
    expect(inv.modoSombrero(CON)).toBe('cabeza');
  });

  it('antes de la cinematica, si se lo puso, lo lleva en la mano; donde no se permite, oculto', () => {
    const inv = crearInventario(memoria());
    inv.fijarSombrero('puesto');
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
    expect(inv.alternarSombrero()).toBe('puesto');
    expect(inv.alternarSombrero()).toBe('guardado');
    inv.alternarSombrero();
    expect(crearInventario(m).sombrero).toBe('puesto');
  });

  it('ignora estados invalidos y datos corruptos', () => {
    const inv = crearInventario(memoria());
    expect(inv.fijarSombrero('volando')).toBe('guardado');
    expect(crearInventario(memoria({ 'idolo.inventario.v1': '{{no json' })).sombrero).toBe('guardado');
    expect(crearInventario(memoria({ 'idolo.inventario.v1': '{"sombrero":"x"}' })).sombrero).toBe('guardado');
  });

  it('funciona sin almacenamiento (modo privado) y si guardar lanza error', () => {
    expect(crearInventario(null).alternarSombrero()).toBe('puesto');
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
    const inv = crearInventario(roto);
    expect(() => inv.fijarSombrero('guardado')).not.toThrow();
    expect(inv.modoSombrero(CON)).toBe('oculto');
  });
});


describe('inventario: guardado en la cuenta (servidor)', () => {
  const catalogo = {
    bate: { id: 'bate', tipo: 'cuerpo', crear: () => {} },
    cuchillo: { id: 'cuchillo', tipo: 'cuerpo', crear: () => {} },
    pistola: { id: 'pistola', tipo: 'pistola', crear: () => {} },
    puños: { id: 'puños', tipo: 'cuerpo', crear: null }
  };
  afterEach(() => vi.useRealTimers());

  it('conectar carga sombrero, mochila y arma de la mano, y devuelve el arma', () => {
    const inv = crearInventario(null), j = { arma: null, municion: 0 };
    inv.ligar(j);
    const mano = inv.conectar({
      sombrero: 'guardado',
      enMano: { arma: 'pistola', municion: 4 },
      mochila: [{ arma: 'bate', municion: 0 }]
    }, catalogo, () => {});
    expect(inv.sombrero).toBe('guardado');
    expect(mano).toBe(catalogo.pistola);
    expect(j).toEqual({ arma: catalogo.pistola, municion: 4 });
    expect(inv.mochila).toEqual([{ arma: catalogo.bate, municion: 0 }]);
  });

  it('descarta lo que el servidor no podria aceptar (armas raras, pistola sin balas, mochila de mas)', () => {
    const inv = crearInventario(null), j = { arma: catalogo.bate, municion: 0 };
    inv.ligar(j);
    inv.conectar({
      sombrero: 'volando',
      enMano: { arma: 'pistola', municion: 0 },
      mochila: [{ arma: 'bazuca' }, { arma: 'puños' }, ...Array(5).fill({ arma: 'cuchillo', municion: 0 })]
    }, catalogo, () => {});
    expect(inv.sombrero).toBe('guardado');
    expect(j.arma).toBeNull();
    expect(inv.mochila).toHaveLength(MAX_MOCHILA);
  });

  it('cada cambio se guarda en el servidor, juntando los seguidos en un solo envio', () => {
    vi.useFakeTimers();
    const guardar = vi.fn(), inv = crearInventario(null), j = { arma: null, municion: 0 };
    inv.ligar(j);
    inv.conectar({}, catalogo, guardar);
    j.arma = catalogo.bate;                              // recoge un bate despues de entrar
    inv.fijarSombrero('guardado');
    inv.guardarEnMano(j);
    inv.cambiarArma(j, 0);
    expect(guardar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith({ sombrero: 'guardado', enMano: { arma: 'bate', municion: 0 }, mochila: [] });
  });

  it('con cuenta no usa el localStorage del navegador (otra cuenta no hereda el sombrero)', () => {
    const m = memoria();
    const inv = crearInventario(m);
    inv.conectar({ sombrero: 'guardado' }, catalogo, () => {});
    inv.fijarSombrero('puesto');
    expect(m.d['idolo.inventario.v1']).toBeUndefined();
  });

  it('guardarAhora envia ya, por ejemplo al morir o cerrar la pagina', () => {
    const guardar = vi.fn(), inv = crearInventario(null), j = { arma: catalogo.pistola, municion: 3 };
    inv.ligar(j);
    inv.conectar({}, catalogo, guardar);
    j.arma = null; j.municion = 0;                       // perdio el arma al morir
    inv.guardarAhora();
    expect(guardar).toHaveBeenCalledWith({ sombrero: 'guardado', enMano: null, mochila: [] });
  });

  it('sin cuenta (invitado) solo recuerda el sombrero en el navegador', () => {
    const m = memoria();
    const inv = crearInventario(m), j = { arma: catalogo.bate, municion: 0 };
    inv.ligar(j);
    inv.fijarSombrero('guardado');
    expect(JSON.parse(m.d['idolo.inventario.v1'])).toEqual({ sombrero: 'guardado' });
  });
});

describe('guardar el sombrero antes de la cinematica', () => {
  it('se puede guardar aunque aun lo lleve en la mano, no reaparece solo y se recuerda al recargar', () => {
    const memoria = new Map();
    const storage = { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v) };
    const inv = crearInventario(storage);
    expect(inv.modoSombrero({ tiene: false, permitido: true })).toBe('oculto');   // empieza guardado
    inv.fijarSombrero('puesto');
    expect(inv.modoSombrero({ tiene: false, permitido: true })).toBe('mano');
    inv.fijarSombrero('guardado');
    expect(inv.modoSombrero({ tiene: false, permitido: true })).toBe('oculto');
    expect(inv.modoSombrero({ tiene: true, permitido: true })).toBe('oculto');     // tras la cinematica sigue guardado
    expect(crearInventario(storage).modoSombrero({ tiene: false, permitido: true })).toBe('oculto');
    inv.fijarSombrero('puesto');
    expect(inv.modoSombrero({ tiene: false, permitido: true })).toBe('mano');
    expect(inv.modoSombrero({ tiene: true, permitido: true })).toBe('cabeza');
  });
});

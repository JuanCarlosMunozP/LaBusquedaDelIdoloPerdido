import { describe, expect, it, vi } from 'vitest';
import { crearSincronizador, elegirPosicion } from '../src/juego/sincronizadorSuministros.js';

// Servidor falso: lleva su propio reloj y entrega lo mismo que el real (aparicion cada 10 s, dura 60 s)
function servidorFalso() {
  const s = { t: 0, reclamados: new Set(), llamadas: { crear: 0, estado: 0, reclamar: 0 }, caido: false, carrera: 'c1' };
  const item = (id, tipo, aparece) => ({ id, tipo, aparece, expira: aparece + 60, candidatos: [{ angulo: 0, fraccion: 0 }] });
  const estado = () => {
    const items = [];
    for (let k = 1; k * 10 <= s.t; k++) {
      for (const [n, tipo] of [[2 * k - 1, 'botiquin'], [2 * k, 'arma']]) {
        if (s.t < k * 10 + 60 && !s.reclamados.has(n)) items.push(item(n, tipo, k * 10));
      }
    }
    return { carrera: s.carrera, ahora: s.t, proxima: (Math.floor(s.t / 10) + 1) * 10, aviso: 10, items };
  };
  s.api = {
    crear: async () => { s.llamadas.crear++; return s.caido ? { ok: false, status: 503 } : { ok: true, datos: estado() }; },
    estado: async (c) => {
      s.llamadas.estado++;
      if (s.caido) return { ok: false, status: 503 };
      return c === s.carrera ? { ok: true, datos: estado() } : { ok: false, status: 404 };
    },
    reclamar: async (_c, id) => {
      s.llamadas.reclamar++;
      if (s.reclamados.has(id)) return { ok: false, status: 404 };
      s.reclamados.add(id);
      return { ok: true, datos: id % 2 ? { tipo: 'botiquin', curacion: 40 } : { tipo: 'arma', arma: 'bate', municion: 0 } };
    }
  };
  return s;
}

function montar() {
  const srv = servidorFalso();
  const reloj = { t: 100 };                          // el reloj local no empieza en 0, como performance.now()
  const sync = crearSincronizador({ api: srv.api, reloj: () => reloj.t });
  const avanzar = (s) => { reloj.t += s; srv.t += s; };
  return { srv, reloj, sync, avanzar };
}

describe('sincronizador de suministros', () => {
  it('abre la carrera al primer sondeo y no pregunta de nuevo hasta que toca la proxima aparicion', async () => {
    const { srv, sync, avanzar } = montar();
    expect(sync.debeSincronizar()).toBe(true);
    await sync.sincronizar();
    expect(srv.llamadas.crear).toBe(1);
    avanzar(5);
    expect(sync.debeSincronizar()).toBe(false);       // faltan 5 s para el siguiente
    avanzar(5.3);
    expect(sync.debeSincronizar()).toBe(true);
  });

  it('informa los suministros nuevos y los que desaparecieron', async () => {
    const { sync, avanzar } = montar();
    await sync.sincronizar();
    avanzar(10.3);
    const a = await sync.sincronizar();
    expect(a.nuevos.map((i) => i.tipo).sort()).toEqual(['arma', 'botiquin']);
    avanzar(10);
    const b = await sync.sincronizar();
    expect(b.nuevos).toHaveLength(2);
    expect(b.quitados).toEqual([]);
    expect(sync.items.size).toBe(4);
    avanzar(50);                                       // los dos primeros ya vencieron
    const c = await sync.sincronizar();
    expect(c.quitados.sort()).toEqual([1, 2]);
  });

  it('lleva la hora del servidor aunque el reloj local sea otro', async () => {
    const { sync, avanzar } = montar();
    await sync.sincronizar();
    avanzar(25);
    expect(sync.tiempo()).toBeCloseTo(25, 5);
    await sync.sincronizar();
    expect(sync.tiempo()).toBeCloseTo(25, 5);
  });

  it('un suministro parpadea solo en los ultimos segundos de vida', async () => {
    const { sync, avanzar } = montar();
    await sync.sincronizar();
    avanzar(10.3);
    await sync.sincronizar();
    const item = [...sync.items.values()][0];
    expect(sync.vigente(item)).toBe(true);
    expect(sync.edad(item)).toBeCloseTo(0.3, 5);
    avanzar(30);                                       // a mitad de vida: siempre visible
    for (let i = 0; i < 10; i++) { avanzar(0.1); expect(sync.visible(item, 10)).toBe(true); }
    avanzar(20);                                       // ultimos 10 s: aparece y desaparece
    const vistas = new Set();
    for (let i = 0; i < 20; i++) { avanzar(0.1); vistas.add(sync.visible(item, 10)); }
    expect(vistas).toEqual(new Set([true, false]));
    avanzar(10);
    expect(sync.vigente(item)).toBe(false);
  });

  it('reclamar devuelve la recompensa del servidor y quita el suministro', async () => {
    const { sync, avanzar } = montar();
    await sync.sincronizar();
    avanzar(10.3);
    await sync.sincronizar();
    expect(await sync.reclamar(1)).toEqual({ ok: true, recompensa: { tipo: 'botiquin', curacion: 40 } });
    expect(sync.items.has(1)).toBe(false);
    expect(await sync.reclamar(2)).toEqual({ ok: true, recompensa: { tipo: 'arma', arma: 'bate', municion: 0 } });
  });

  it('si ya no esta disponible lo marca como perdido y lo quita, sin lanzar', async () => {
    const { srv, sync, avanzar } = montar();
    await sync.sincronizar();
    avanzar(10.3);
    await sync.sincronizar();
    srv.reclamados.add(1);                             // otro lo recogio antes
    expect(await sync.reclamar(1)).toEqual({ ok: false, perdido: true });
    expect(sync.items.has(1)).toBe(false);
  });

  it('si el servidor esta caido reintenta despacio, no cada cuadro, y no lanza', async () => {
    const { srv, sync, avanzar } = montar();
    srv.caido = true;
    expect(await sync.sincronizar()).toBeNull();
    expect(sync.debeSincronizar()).toBe(false);
    avanzar(5.1);
    expect(sync.debeSincronizar()).toBe(true);
    srv.caido = false;
    expect(await sync.sincronizar()).not.toBeNull();
    const arriba = vi.fn(async () => { throw new Error('red'); });
    const roto = crearSincronizador({ api: { crear: arriba, estado: arriba, reclamar: arriba }, reloj: () => 0 });
    expect(await roto.sincronizar()).toBeNull();
    expect(await roto.reclamar(1)).toEqual({ ok: false });
  });

  it('si el servidor olvido la carrera (reinicio) abre una nueva y avisa de lo que se perdio', async () => {
    const { srv, sync, avanzar } = montar();
    await sync.sincronizar();
    avanzar(10.3);
    await sync.sincronizar();
    srv.carrera = 'c2';                                 // el servidor se reinicio: la carrera c1 ya no existe
    avanzar(10);
    const perdida = await sync.sincronizar();
    expect(perdida.quitados.length).toBe(2);
    expect(sync.items.size).toBe(0);
    expect(sync.debeSincronizar()).toBe(true);          // la proxima consulta abre una carrera nueva
    await sync.sincronizar();
    expect(sync.carrera).toBe('c2');
  });

  it('reiniciar descarta todo y una respuesta que llega tarde no contamina la partida nueva', async () => {
    const { srv, sync, avanzar } = montar();
    await sync.sincronizar();
    avanzar(10.3);
    await sync.sincronizar();
    expect(sync.items.size).toBe(2);
    let soltar;
    srv.api.estado = () => new Promise((resolver) => { soltar = () => resolver({ ok: true, datos: { carrera: 'c1', ahora: 99, proxima: 100, aviso: 10, items: [{ id: 77, tipo: 'arma', aparece: 90, expira: 150, candidatos: [] }] } }); });
    avanzar(11);
    const pendiente = sync.sincronizar();
    sync.reiniciar();                                   // cambio de nivel mientras se esperaba
    soltar();
    expect(await pendiente).toBeNull();
    expect(sync.items.size).toBe(0);
    expect(sync.carrera).toBeNull();
    expect(sync.debeSincronizar()).toBe(true);
  });
});

describe('elegirPosicion', () => {
  it('toma la primera posicion candidata valida y calcula el punto en el mapa', () => {
    const candidatos = [{ angulo: 0, fraccion: 0 }, { angulo: Math.PI / 2, fraccion: 1 }, { angulo: Math.PI, fraccion: 0.5 }];
    const valido = vi.fn((x) => (x < 0 ? { y: 2 } : null));
    const p = elegirPosicion(candidatos, 100, valido);
    expect(valido).toHaveBeenCalledTimes(3);
    expect(p.y).toBe(2);
    expect(p.x).toBeCloseTo(-(5 + 0.5 * 100 * 0.7), 5);
    expect(p.z).toBeCloseTo(0, 5);
  });

  it('respeta el radio minimo de 5 m y el 70 % del mapa como maximo', () => {
    const tope = elegirPosicion([{ angulo: 0, fraccion: 1 }], 100, (x) => ({ y: x }));
    expect(tope.x).toBeCloseTo(75, 5);
    expect(elegirPosicion([{ angulo: 0, fraccion: 0 }], 100, (x) => ({ y: x })).x).toBeCloseTo(5, 5);
  });

  it('devuelve null si ninguna sirve', () => {
    expect(elegirPosicion([{ angulo: 1, fraccion: 0.3 }], 50, () => null)).toBeNull();
    expect(elegirPosicion([], 50, () => ({ y: 0 }))).toBeNull();
  });
});

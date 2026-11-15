import { describe, expect, it, vi } from 'vitest';
import { crearRed, normalizarCodigo, urlSala } from '../src/multijugador/red.js';
import { crearRemotos, suavizar, suavizarAngulo } from '../src/multijugador/remotos.js';
import { crearPartida } from '../src/multijugador/partida.js';
import { modeloSala } from '../src/interfaz/modalSala.js';

function socketFalso() {
  const s = { readyState: 1, enviados: [], send(t) { s.enviados.push(JSON.parse(t)); }, close: vi.fn() };
  return s;
}

describe('red', () => {
  it('usa wss en https y ws en http', () => {
    expect(urlSala({ protocol: 'https:', host: 'juego.onrender.com' }, 'AB3DE')).toBe('wss://juego.onrender.com/api/v1/ws/rooms/AB3DE');
    expect(urlSala({ protocol: 'http:', host: 'localhost:5173' }, 'AB3DE')).toBe('ws://localhost:5173/api/v1/ws/rooms/AB3DE');
  });

  it('normaliza codigos: 5 caracteres sin letras confusas', () => {
    expect(normalizarCodigo(' ab3de ')).toBe('AB3DE');
    for (const malo of ['', 'ABCD', 'ABCDEF', 'AB0DE', 'AB1DE', 'ABODE', 'ABIDE', 'ABLDE', null, undefined, 'AB DE']) expect(normalizarCodigo(malo)).toBeNull();
  });

  it('manda el estado a lo sumo cada 100 ms y solo con el socket abierto', () => {
    const s = socketFalso();
    const reloj = { t: 0 };
    const red = crearRed({ url: 'x', alMensaje() {}, crearSocket: () => s, reloj: () => reloj.t });
    expect(red.enviarEstado({ x: 1 })).toBe(false);          // aun sin conectar
    red.conectar();
    expect(red.enviarEstado({ x: 1 })).toBe(true);
    reloj.t = 50;
    expect(red.enviarEstado({ x: 2 })).toBe(false);
    reloj.t = 120;
    expect(red.enviarEstado({ x: 3 })).toBe(true);
    expect(s.enviados).toEqual([{ t: 'estado', x: 1 }, { t: 'estado', x: 3 }]);
    s.readyState = 3;
    reloj.t = 999;
    expect(red.enviarEstado({ x: 4 })).toBe(false);
  });

  it('entrega solo mensajes validos y avisa al cerrarse', () => {
    const s = socketFalso();
    const recibidos = [];
    const cierres = [];
    const red = crearRed({ url: 'x', alMensaje: (m) => recibidos.push(m), alCerrar: (c) => cierres.push(c), crearSocket: () => s });
    red.conectar();
    for (const basura of ['no es json', '[]', '"x"', '{"sin":"tipo"}', '{"t":5}']) s.onmessage({ data: basura });
    s.onmessage({ data: '{"t":"sale","id":"u1"}' });
    expect(recibidos).toEqual([{ t: 'sale', id: 'u1' }]);
    s.onclose({ code: 4404 });
    expect(cierres).toEqual([4404]);
    expect(red.abierta).toBe(false);
  });
});

describe('remotos', () => {
  const humano = () => ({ grupo: { position: { set: vi.fn() }, visible: true }, mirarHacia: vi.fn(), actualizar: vi.fn() });
  const montar = () => {
    const scene = { add: vi.fn(), remove: vi.fn() };
    const creados = [];
    const remotos = crearRemotos({ scene, crearHumano: () => { const h = humano(); creados.push(h); return h; } });
    return { scene, creados, remotos };
  };
  const dato = (extra = {}) => ({ id: 'u2', nombre: 'Luz', x: 10, y: 1, z: 5, ry: 0, nadando: false, sombrero: true, nivel: 0, ...extra });

  it('suaviza sin pasarse y gira por el camino corto', () => {
    expect(suavizar(0, 10, 0.05)).toBeGreaterThan(0);
    expect(suavizar(0, 10, 0.05)).toBeLessThan(10);
    expect(suavizar(0, 10, 100)).toBeCloseTo(10, 5);
    expect(suavizarAngulo(3.1, -3.1, 100)).toBeCloseTo(-3.1 + 2 * Math.PI, 5);     // llega al mismo angulo, dando la vuelta corta
    const paso = suavizarAngulo(3.1, -3.1, 0.05);
    expect(Math.abs(paso - 3.1)).toBeLessThan(0.3);                  // fue por el camino corto
  });

  it('crea un modelo por jugador, lo mueve y lo quita', () => {
    const { scene, creados, remotos } = montar();
    remotos.aplicar(dato());
    remotos.aplicar(dato({ x: 12 }));
    expect(creados).toHaveLength(1);
    expect(scene.add).toHaveBeenCalledTimes(1);
    remotos.actualizar(0.016, 1, 0);
    expect(creados[0].grupo.position.set).toHaveBeenCalled();
    expect(creados[0].actualizar).toHaveBeenCalled();
    remotos.quitar('u2');
    expect(scene.remove).toHaveBeenCalledWith(creados[0].grupo);
    expect(remotos.cantidad).toBe(0);
  });

  it('solo se ven los jugadores del mismo nivel', () => {
    const { creados, remotos } = montar();
    remotos.aplicar(dato({ nivel: 2 }));
    remotos.actualizar(0.016, 1, 0);
    expect(creados[0].grupo.visible).toBe(false);
    expect(creados[0].actualizar).not.toHaveBeenCalled();
    remotos.actualizar(0.016, 1, 2);
    expect(creados[0].grupo.visible).toBe(true);
  });

  it('ignora datos sin id', () => {
    const { remotos } = montar();
    remotos.aplicar(null);
    remotos.aplicar({ x: 1 });
    expect(remotos.cantidad).toBe(0);
  });
});

describe('partida', () => {
  function montar() {
    let cb;
    const red = { conectar: vi.fn(), cerrar: vi.fn(), enviarEstado: vi.fn() };
    const avisos = [];
    const correcciones = [];
    const scene = { add() {}, remove() {} };
    const partida = crearPartida({
      scene, avisar: (t) => avisos.push(t), corregir: (...p) => correcciones.push(p),
      crearHumano: () => ({ grupo: { position: { set() {} } }, mirarHacia() {}, actualizar() {} }),
      foto: () => ({ x: 0 }), loc: { protocol: 'https:', host: 'h' },
      fabricaRed: (opciones) => { cb = opciones; return red; }
    });
    return { partida, red, avisos, correcciones, msg: (m) => cb.alMensaje(m), cerrarRed: () => cb.alCerrar(1006) };
  }

  it('al entrar dibuja a los demas (no a mi) y avisa', () => {
    const { partida, msg, avisos } = montar();
    partida.conectar('AB3DE');
    msg({ t: 'sala', codigo: 'AB3DE', tuId: 'yo', max: 4, jugadores: [{ id: 'yo', nombre: 'Yo' }, { id: 'u2', nombre: 'Luz', nivel: 0 }] });
    expect(partida.remotos.ids()).toEqual(['u2']);
    expect(avisos[0]).toMatch(/AB3DE.*2 de 4/);
    msg({ t: 'entra', jugador: { id: 'u3', nombre: 'Rey', nivel: 0 } });
    msg({ t: 'estado', jugador: { id: 'yo', x: 5 } });
    expect(partida.remotos.ids()).toEqual(['u2', 'u3']);
    msg({ t: 'sale', id: 'u2' });
    expect(partida.remotos.ids()).toEqual(['u3']);
  });

  it('el servidor puede corregir mi posicion y avisar de errores', () => {
    const { partida, msg, correcciones, avisos } = montar();
    partida.conectar('AB3DE');
    msg({ t: 'corregir', x: 1, y: 2, z: 3 });
    expect(correcciones).toEqual([[1, 2, 3]]);
    msg({ t: 'error', mensaje: 'La sala está llena (4 jugadores).' });
    expect(avisos.at(-1)).toMatch(/llena/);
  });

  it('manda mi estado cada cuadro solo si hay conexion, y al caerse limpia todo', () => {
    const { partida, red, msg, cerrarRed, avisos } = montar();
    partida.actualizar(0.016, 1, 0);
    expect(red.enviarEstado).not.toHaveBeenCalled();
    partida.conectar('AB3DE');
    msg({ t: 'entra', jugador: { id: 'u2', nombre: 'Luz', nivel: 0 } });
    partida.actualizar(0.016, 1, 0);
    expect(red.enviarEstado).toHaveBeenCalledWith({ x: 0 });
    cerrarRed();
    expect(partida.activa).toBe(false);
    expect(partida.remotos.cantidad).toBe(0);
    expect(avisos.at(-1)).toMatch(/conexión/);
  });

  it('cerrar a proposito no avisa de conexion perdida', () => {
    const { partida, red, avisos } = montar();
    partida.conectar('AB3DE');
    partida.cerrar();
    expect(red.cerrar).toHaveBeenCalled();
    expect(avisos).toEqual([]);
  });
});

describe('ventana de sala', () => {
  it('sin cuenta no deja jugar en linea', () => {
    const m = modeloSala({ conCuenta: false });
    expect(m.puedeJugar).toBe(false);
    expect(m.texto).toMatch(/cuenta/);
  });
  it('con cuenta ofrece crear o unirse, de hasta 4 jugadores', () => {
    const m = modeloSala({ conCuenta: true });
    expect(m.puedeJugar).toBe(true);
    expect(m.texto).toMatch(/4 jugadores/);
  });
});

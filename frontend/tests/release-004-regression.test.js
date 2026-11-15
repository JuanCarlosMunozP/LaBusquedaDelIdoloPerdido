import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { Enemigo } from '../src/personajes/enemigo.js';
import { prepararPartida, limpiarPartida } from './helpers/partida.js';

const combate = readFileSync(new URL('../src/juego/combate.js', import.meta.url), 'utf8');
function funcion(source, nombre) {
  const inicio = source.indexOf(`function ${nombre}(`);
  const fin = source.indexOf('\n}', inicio);
  if (inicio < 0 || fin < 0) throw new Error(`No se encontró ${nombre}`);
  const async = source.slice(Math.max(0, inicio - 6), inicio) === 'async ';
  return `${async ? 'async ' : ''}${source.slice(inicio, fin + 2)}`;
}

// Funciones reales de ciclo.js y niveles.js (ver helpers/partida.js); reloj falso, sin navegador ni carga de GLB.
async function prepararNivel() {
  const h = await prepararPartida({ vida: 0 });
  return { ...h, api: { matarJugador: h.ciclo.matarJugador, pausar: h.ciclo.pausar,
    empezarNivel: h.niveles.empezarNivel, estado: () => h.g.estado }, completar: () => h.resolverCargas() };
}

describe('RELEASE-004: muerte pendiente y pausa (CU-011, POL-FSM-001)', () => {
  afterEach(() => limpiarPartida());

  it('R004-001: pausa conserva muerte legítima a 1499/1500 ms sin carga', async () => {
    const h = await prepararNivel();
    h.api.matarJugador(); h.api.pausar();
    await h.avanzar(1499);
    expect(h.api.estado()).toBe('pausa');
    expect(h.pantallaFinal).not.toHaveBeenCalled();
    await h.avanzar(1);
    expect(h.api.estado()).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
    await h.avanzar(1500);
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });

  // Supuesto explícito de regresión: empezarNivel continúa la misma partida;
  // no se ha invocado reinicio. La prioridad general carga/muerte sigue pendiente
  // de decisión humana; estos casos no autorizan muerte prioritaria sobre WIN.
  it('R004-002: misma partida pausada no pierde su derrota al iniciar carga pendiente', async () => {
    const h = await prepararNivel();
    h.api.matarJugador(); h.api.pausar();
    const cambio = h.api.empezarNivel(1);
    await h.avanzar(1500);
    const estadoAlVencer = h.api.estado();
    await h.completar(); await cambio;
    expect(estadoAlVencer).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });

  it('R004-003: completar carga en la misma partida no revive muerte pendiente pausada', async () => {
    const h = await prepararNivel();
    h.api.matarJugador(); h.api.pausar();
    const cambio = h.api.empezarNivel(1);
    await h.completar(); await cambio;
    expect(h.jugador.vivo).toBe(false);
    await h.avanzar(1500);
    expect(h.api.estado()).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });
});

function disparoJugador(obstaculos, distancia = 8) {
  const recibirGolpe = vi.fn(() => false);
  const scene = new THREE.Scene();
  const jugador = { pos: new THREE.Vector3(), municion: 2, arma: { golpeEnemigo: 1.5 } };
  // Funciones de producción completas; solo decir y el scheduler visual son dobles.
  const disparar = runInNewContext(`
    const ALCANCE_PISTOLA = 18;
    ${funcion(combate, 'danarEnemigo')}
    ${funcion(combate, 'dispararJugador')}
    dispararJugador;
  `, { THREE, decir: vi.fn(), setTimeout: () => 1 });
  disparar({ jugador, scene, axel: {}, vista: { yaw: Math.PI },
    enemigos: [{ vivo: true, pos: new THREE.Vector3(0, 0, distancia), recibirGolpe }],
    mundo: { obstaculos }, sonido: { disparo: vi.fn(), impacto: vi.fn() }, obj: {} });
  for (const o of scene.children) { o.geometry?.dispose(); o.material?.dispose(); }
  return { recibirGolpe, jugador };
}

describe('RELEASE-004: trayectorias jugador (CU-010, RF-005)', () => {
  it('R004-004: trayectoria libre alcanza objetivo y consume una bala', () => {
    const h = disparoJugador([]);
    expect(h.recibirGolpe).toHaveBeenCalledTimes(1);
    expect(h.jugador.municion).toBe(1);
  });
  it('R004-005: obstáculo intermedio bloquea impacto', () => {
    expect(disparoJugador([{ x: 0, z: 4, r: 1 }]).recibirGolpe).not.toHaveBeenCalled();
  });
  it('R004-006: obstáculo fuera de trayectoria no bloquea impacto', () => {
    expect(disparoJugador([{ x: 3, z: 4, r: 1 }]).recibirGolpe).toHaveBeenCalledTimes(1);
  });
  it('R004-007: borde delantero de obstáculo bloquea aunque su centro quede detrás del blanco', () => {
    expect(disparoJugador([{ x: 0, z: 8.5, r: 1 }]).recibirGolpe).not.toHaveBeenCalled();
  });
});

function balaEnemiga(obstaculos) {
  const danar = vi.fn();
  const mesh = { position: new THREE.Vector3(0, 1.3, 0) };
  const enemigo = { mundo: { obstaculos, altura: () => 0 }, scene: { remove: vi.fn() },
    balas: [{ mesh, vel: new THREE.Vector3(0, 0, 26), vida: 1.6 }] };
  Enemigo.prototype.actualizarBalas.call(enemigo, 0.05,
    { vivo: true, pos: new THREE.Vector3(0, 0, 1.3), direccion: 0 }, danar);
  return { enemigo, danar };
}

describe('RELEASE-004: trayectorias enemigo real (CU-010, RF-005)', () => {
  it('R004-008: proyectil libre alcanza al jugador una sola vez y se retira', () => {
    const h = balaEnemiga([]);
    expect(h.danar).toHaveBeenCalledTimes(1);
    expect(h.enemigo.balas).toHaveLength(0);
  });
  it('R004-009: obstáculo intermedio bloquea proyectil enemigo', () => {
    const h = balaEnemiga([{ x: 0, z: 0.65, r: 0.2 }]);
    expect(h.danar).not.toHaveBeenCalled();
    expect(h.enemigo.balas).toHaveLength(0);
  });
  it('R004-010: obstáculo estrecho entre muestras también bloquea trayectoria', () => {
    expect(balaEnemiga([{ x: 0, z: 0.4875, r: 0.1 }]).danar).not.toHaveBeenCalled();
  });
});

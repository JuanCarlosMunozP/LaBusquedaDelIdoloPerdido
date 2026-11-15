// Arma una partida aislada para las pruebas del ciclo de juego (ciclo.js y niveles.js): modulos reales,
// con el navegador, el render, el sonido, la interfaz y la cuenta sustituidos por dobles.
// Cada llamada carga copias nuevas de los modulos, asi que dos partidas no comparten estado
// (equivale a recargar la pagina). Usa temporizadores falsos: llamar a limpiarPartida() al terminar.
import { vi } from 'vitest';
import * as THREE from 'three';

const tick = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

export async function prepararPartida({ vida = 100 } = {}) {
  vi.resetModules();
  if (!vi.isFakeTimers()) vi.useFakeTimers();
  const scene = new THREE.Scene();
  const cargas = [], liberados = [];
  const mundoDe = (tema, objeto = new THREE.Group()) => ({
    objetos: [objeto], spawn: { x: tema.n * 10, z: 0 }, altura: () => 0, tema, obstaculos: [],
    portal: { activo: true, x: 0, z: 0, radio: 2 }, actualizar: vi.fn(), seguirCamara: vi.fn(),
  });
  const document = { exitPointerLock: vi.fn(), getElementById: () => ({}) };
  vi.stubGlobal('document', document);

  const clases = { toggle: vi.fn(), remove: vi.fn() };
  const hud = { titulo: {}, texto: {}, boton: {}, pantalla: { classList: clases }, dano: { style: {} },
    filaFrio: { classList: clases }, filaCalor: { classList: clases } };
  const interfaz = { hud, decir: vi.fn(), fundido: { style: { opacity: 0 } }, cerrarDialogo: vi.fn(),
    cajaDialogo: { style: {} }, avisoHablar: { style: {} }, pantallaFinal: vi.fn() };
  const sonido = { derrota: vi.fn(), victoria: vi.fn(), dolor: vi.fn() };
  const suministros = { reiniciar: vi.fn() };
  const frio = { reiniciar: vi.fn(), activo: false };
  const cuenta = { guardarNivel: vi.fn(), registrarVictoria: vi.fn() };
  const mundoMock = {
    crearMundo: vi.fn((escena, loader, tema) => {
      let resolver;
      const promesa = new Promise((r) => { resolver = r; });
      const objeto = new THREE.Group(); escena.add(objeto);
      const mundo = mundoDe(tema, objeto);
      cargas.push({ mundo, resuelta: false, resolver: () => resolver(mundo) });
      return promesa;
    }),
    liberar: vi.fn((escena, objetos) => { for (const o of objetos) { escena.remove(o); liberados.push(o); } }),
  };

  vi.doMock('../../src/juego/escena.js', () => ({ scene, camera: new THREE.PerspectiveCamera(),
    renderer: { compileAsync: vi.fn(async () => {}) }, bloquearRaton: vi.fn() }));
  vi.doMock('../../src/juego/servicios.js', () => ({ sonido, gltfLoader: {}, suministros, frio }));
  vi.doMock('../../src/interfaz/hud.js', () => interfaz);
  vi.doMock('../../src/interfaz/dispositivo.js', () => ({ dispositivo: { tactil: false } }));
  vi.doMock('../../src/cuenta/cuenta.js', () => cuenta);
  vi.doMock('../../src/escenario/casa.js', () => ({ montarEscenaFinal: vi.fn(async () => {}) }));
  vi.doMock('../../src/escenario/mundo.js', () => mundoMock);
  vi.doMock('../../src/escenario/temas.js', () => ({ TEMAS: [0, 1, 2].map((n) => ({ n })) }));
  vi.doMock('../../src/juego/datos.js', () => ({
    NIVELES: [0, 1, 2].map((n) => ({ nombre: `Nivel ${n}`, enemigos: 0 })), IDOLOS_POR_NIVEL: 2, CASAS: [] }));
  vi.doMock('three/examples/jsm/utils/SkeletonUtils.js', () => ({ clone: () => ({}) }));
  vi.doMock('../../src/personajes/enemigo.js', () => ({ Enemigo: class {} }));
  vi.doMock('../../src/personajes/daniel.js', () => ({ crearDaniel: () => ({ grupo: new THREE.Group() }) }));

  const { g, jugador } = await import('../../src/juego/estadoJuego.js');
  const ciclo = await import('../../src/juego/ciclo.js');
  const niveles = await import('../../src/juego/niveles.js');

  const inicial = mundoDe({ n: 0 });
  scene.add(...inicial.objetos);
  const axelInicial = { morir: vi.fn(), destello: vi.fn(), herir: vi.fn(), grupo: new THREE.Group() };
  Object.assign(jugador, { vivo: true, vida, invulnerable: 0 });
  Object.assign(g, { estado: 'jugando', mundo: inicial, axel: axelInicial, tiempoFinal: 10, modeloEnemigo: {} });

  return {
    g, jugador, ciclo, niveles, scene, inicial, axelInicial, cargas, liberados, document,
    hud, decir: interfaz.decir, fundido: interfaz.fundido, pantallaFinal: interfaz.pantallaFinal,
    sonido, suministros, frio, cuenta,
    leer: () => ({ estado: g.estado, nivel: g.nivel, cambiandoNivel: g.cambiandoNivel, mundo: g.mundo }),
    async resolverCargas() {
      for (let ronda = 0; ronda < 8; ronda++) {
        await tick();
        for (const carga of cargas) if (!carga.resuelta) { carga.resuelta = true; carga.resolver(); }
      }
      await tick();
    },
    async avanzar(ms) { await vi.advanceTimersByTimeAsync(ms); await tick(); },
    tick,
  };
}

export function limpiarPartida() {
  vi.useRealTimers();
  vi.unstubAllGlobals();
}

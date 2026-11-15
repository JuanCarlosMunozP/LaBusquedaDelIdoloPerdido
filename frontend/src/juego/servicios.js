// Servicios de la partida: sonido, inventario, suministros, multijugador, frio y camara en tercera persona.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonarModelo } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Humano, VESTUARIO_AXEL } from '../personajes/personaje.js';
import { Sonido } from '../audio/audio.js';
import { crearVista } from './camara.js';
import { crearFrio } from './frio.js';
import { crearSuministros } from './suministros.js';
import { crearInventario } from './inventario.js';
import { crearObjetosSueltos } from './soltar.js';
import { crearPartida } from '../multijugador/partida.js';
import { decir } from '../interfaz/hud.js';
import { g, jugador } from './estadoJuego.js';
import { scene, camera } from './escena.js';

export const sonido = new Sonido();
export const objetosSueltos = crearObjetosSueltos(scene);   // arma y sombrero que caen al morir
export const inventario = crearInventario();
window.addEventListener("pagehide", () => inventario.guardarAhora());   // no perder un cambio reciente al cerrar
export const gltfLoader = new GLTFLoader();

inventario.ligar(jugador);               // el arma de la mano y la mochila se guardan juntas
export const suministros = crearSuministros({ scene, sonido, jugador, inventario });   // botiquines y kits de arma al azar
export const partida = crearPartida({            // multijugador: sala de hasta 4 jugadores con cuenta (multijugador/partida.js)
  scene,
  avisar: (texto) => decir(texto, 4),
  crearHumano: () => { const h = new Humano(clonarModelo(g.modeloEnemigo)); h.personalizarCabelloAxel(); h.vestir(VESTUARIO_AXEL); return h; },
  foto: () => ({
    x: jugador.pos.x, y: jugador.pos.y, z: jugador.pos.z, ry: g.axel.direccion, nadando: jugador.nadando,
    golpe: g.axel.golpeT >= 0, vida: Math.round(jugador.vida), arma: jugador.arma?.id ?? "",
    sombrero: inventario.sombrero === "puesto", nivel: g.nivel
  }),
  corregir: (x, y, z) => jugador.pos.set(x, y, z)       // el servidor rechazo una posicion imposible
});
export const frio = crearFrio();             // barras de frio y calor (solo en la montaña)
export const vista = crearVista(scene, camera);   // camara en tercera persona (camara.js)

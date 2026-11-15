// Estado compartido de la partida. Lo que se reasigna vive en `g` (estado, nivel, mundo...);
// los objetos que nunca se reemplazan se exportan directamente.
import * as THREE from 'three';

export const g = {
  estado: "cargando",             // cargando | inicio | jugando | pausa | victoria | derrota
  nivel: 0,
  cambiandoNivel: false,
  solicitudNivel: 0,
  metaLista: false,               // objetivos completos: el bote ya esta en el mar
  cine: null,                     // cinematica en curso (estado "cinematica")
  misionesAceptadas: false,
  dialogo: null,                  // { lineas, i } mientras Daniel habla
  mundo: undefined,
  axel: undefined,
  daniel: undefined,
  modeloEnemigo: undefined,
  tiempo: 0,
  tiempoFinal: 0,
  codigoSala: null,
  tactil: null                    // controles en pantalla (solo moviles y tabletas)
};

export const cinematicasVistas = new Set();   // niveles cuyo choque de avion ya se vio (Max se pone el sombrero despues)
export const cinesHechas = new Set();         // "nivel:linea" de cada cinematica ya mostrada
export const obj = { idolos: 0, derrotados: 0, fogata: false, altar: false, nado: 0 };
export const danielPos = new THREE.Vector3();
export const enemigos = [];

export const jugador = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  vy: 0,
  enSuelo: true,
  vida: 100,
  vivo: true,
  idolos: 0,
  invulnerable: 0,
  golpeCooldown: 0,
  golpePendiente: -1,
  heridasT: 0,
  nadando: false,
  arma: null,           // arma de un kit (null = puños)
  municion: 0
};

export const esTerminal = () => g.estado === "victoria" || g.estado === "derrota";
export const nivelVigente = (id) => id === g.solicitudNivel && jugador.vivo && !esTerminal();

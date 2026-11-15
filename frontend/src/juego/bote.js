// Bote de remos del nivel del mar: al cumplir los objetivos aparece en la orilla (escenario/portal.js)
// y SOLO el jugador puede subirse y remar con W A S D hasta la baliza del mar; Espacio para bajarse.
// Los mercenarios no lo usan: ni lo ven como objetivo ni lo mueven. Aqui vive el estado "abordo"
// y la posicion del bote mientras se rema; la pose de remar es Humano.poseRemar.
import { decir } from '../interfaz/hud.js';
import { g, jugador } from './estadoJuego.js';
import { sonido } from './servicios.js';
import { teclas } from './controles.js';

const DISTANCIA_ABORDAR = 2.3;
const DISTANCIA_REARMAR = 3.6;      // tras bajarse hay que alejarse un poco para volver a subir
const ALTURA_BANCO = 0.42;          // el jugador va sentado en el banco del bote
let espacioAntes = false;
let bajado = false;

const hayBote = () => g.metaLista && g.mundo.tema.vehiculo === "bote" && g.mundo.portal.activo;
const datos = () => g.mundo.portal.bote;

// Cada cuadro, antes de calcular el movimiento: subir, bajar y avanzar el ritmo de remada.
export function actualizarBote(dt, moviendo) {
  if (!hayBote() || !jugador.vivo) { jugador.enBote = false; g.axel.remando = 0; return; }
  const b = datos();
  const distancia = Math.hypot(jugador.pos.x - b.x, jugador.pos.z - b.z);
  const espacio = !!teclas[" "];
  if (jugador.enBote) {
    if (espacio && !espacioAntes) {                       // bajarse: se queda nadando junto al bote
      jugador.enBote = false; b.abordo = false; bajado = true;
      decir("Te has bajado del bote.", 2);
    }
  } else {
    if (bajado && distancia > DISTANCIA_REARMAR) bajado = false;
    if (!bajado && distancia < DISTANCIA_ABORDAR && g.axel) {
      jugador.enBote = true; b.abordo = true;
      jugador.pos.x = b.x; jugador.pos.z = b.z; jugador.vel.x = jugador.vel.z = 0;
      sonido.equipar();
      decir("Estás en el bote: rema con W A S D hasta la baliza (Espacio para bajar).", 6);
    }
  }
  espacioAntes = espacio;
  if (jugador.enBote) {
    const velocidad = Math.hypot(jugador.vel.x, jugador.vel.z);
    b.fase += dt * (1.8 + 1.1 * velocidad);
    b.remada += ((moviendo ? 1 : 0.12) - b.remada) * Math.min(1, dt * 5);
  } else b.remada += (0 - b.remada) * Math.min(1, dt * 5);
  g.axel.remando = jugador.enBote ? b.remada + 0.001 : 0;   // >0: sentado remando (ver poseRemar)
  g.axel.faseBote = b.fase;
}

// Tras mover al jugador: el bote no sube a tierra (si lo intenta se queda donde estaba) y lo sigue.
export function sincronizarBote(xAntes, zAntes, dt) {
  const b = datos();
  if (g.mundo.altura(jugador.pos.x, jugador.pos.z) > -0.35) {
    jugador.pos.x = xAntes; jugador.pos.z = zAntes;
    jugador.vel.x = jugador.vel.z = 0;
  }
  b.x = jugador.pos.x; b.z = jugador.pos.z;
  if (Math.hypot(jugador.vel.x, jugador.vel.z) > 0.3) {   // la proa gira suave hacia donde se avanza
    const objetivo = Math.atan2(jugador.vel.x, jugador.vel.z);
    const dif = Math.atan2(Math.sin(objetivo - b.yaw), Math.cos(objetivo - b.yaw));
    b.yaw += dif * Math.min(1, dt * 4);
  }
}

// Altura a la que va el jugador sentado en el banco.
export const alturaBanco = () => (datos().y ?? -0.05) + ALTURA_BANCO;

// Controles: teclado, raton, pausa automatica y controles tactiles (solo moviles y tabletas).
import * as THREE from 'three';
import { cajaDialogo } from '../interfaz/hud.js';
import { dispositivo } from '../interfaz/dispositivo.js';
import { crearControlesTactiles } from '../interfaz/tactil.js';
import { g } from './estadoJuego.js';
import { bloquearRaton } from './escena.js';
import { vista } from './servicios.js';
import { pausar } from './ciclo.js';
import { iniciarRecarga } from './recarga.js';
import { reiniciarPartida } from './reinicio.js';
import { atacar } from './combateJugador.js';
import { hablarSiEstaCerca } from './dialogoDaniel.js';
import { abrirInventario, cerrarInventario, teclaInventario, equiparRanura } from './inventarioJuego.js';

export const teclas = {};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  teclas[k] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (g.estado === "jugando" && (k === "f" || k === "j") && !g.dialogo) atacar();
  if (g.estado === "jugando" && k === "r" && !e.repeat && !g.dialogo) iniciarRecarga();   // R: recargar la pistola
  if (g.estado === "jugando" && k === "t") hablarSiEstaCerca();           // T: hablar con Daniel
  if (g.estado === "jugando" && !g.dialogo && !e.repeat && k >= "1" && k <= "9") equiparRanura(Number(k) - 1);   // 1-9: cambiar de objeto
  if (k === "e" && !e.repeat) {                                          // E: inventario (abre y cierra)
    if (g.estado === "inventario") cerrarInventario(); else abrirInventario();
  } else if (g.estado === "inventario") teclaInventario(k);
  if (k === "r" && (g.estado === "victoria" || g.estado === "derrota")) reiniciarPartida();
});
window.addEventListener("keyup", (e) => { teclas[e.key.toLowerCase()] = false; });

window.addEventListener("mousedown", (e) => {
  if (dispositivo.tactil || g.estado !== "jugando" || e.button !== 0) return;   // en el movil se usan los botones en pantalla
  if (!document.pointerLockElement) bloquearRaton();   // recupera el ratón (p. ej. tras la cinemática)
  else if (!g.dialogo) atacar();
});

window.addEventListener("mousemove", (e) => {
  if (g.estado !== "jugando" || !document.pointerLockElement) return;
  vista.yaw -= e.movementX * 0.0025;
  vista.pitch = THREE.MathUtils.clamp(vista.pitch + e.movementY * 0.002, -0.15, 1.15);
});

document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement && (g.estado === "jugando" || g.estado === "cinematica")) pausar();
});

g.tactil = dispositivo.tactil ? crearControlesTactiles(vista, {
  atacar: () => { if (g.estado === "jugando" && !g.dialogo) atacar(); },
  hablar: hablarSiEstaCerca,
  pausar: () => { if (g.estado === "jugando") pausar(); },
  inventario: () => { if (g.estado === "inventario") cerrarInventario(); else abrirInventario(); }
}) : null;
cajaDialogo.addEventListener("pointerdown", () => { if (g.tactil) hablarSiEstaCerca(); });   // tocar el cuadro avanza el dialogo

// Al cambiar de pestaña o apagar la pantalla, el juego se pausa solo
document.addEventListener("visibilitychange", () => { if (document.hidden && g.estado === "jugando") pausar(); });

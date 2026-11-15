// Actualizacion por cuadro del jugador: combate, movimiento, animacion, entorno, objetivos y HUD.
import * as THREE from 'three';
import { resolverGolpe } from './combate.js';
import { hud, decir, pintarObjetivos, avisoHablar } from '../interfaz/hud.js';
import { IDOLOS_POR_NIVEL, METROS_NADO, NIVELES, objetivos } from './datos.js';
import { g, jugador, obj, enemigos, danielPos, cinematicasVistas } from './estadoJuego.js';
import { sonido, vista, frio, suministros, inventario } from './servicios.js';
import { teclas } from './controles.js';
import { matarJugador } from './ciclo.js';
import { revisarPortal } from './niveles.js';

let avisoMar = 0;
let avisoFrio = 0;
let pasoAnterior = 0;
let proximaBrazada = 0;
let proximoSondeoAgua = 0;           // el sonido del agua se recalcula 5 veces por segundo

// Escribir en el DOM cada cuadro fuerza al navegador a recalcular el diseno aunque el valor no haya
// cambiado: estos ayudantes solo tocan el elemento cuando el valor es distinto.
const ultimoTexto = new WeakMap(), ultimoAncho = new WeakMap();
function ponerTexto(el, texto) {
  if (ultimoTexto.get(el) === texto) return;
  ultimoTexto.set(el, texto);
  el.textContent = texto;
}
function ponerAncho(el, pct) {
  const v = Math.round(pct * 10) / 10;          // una decima de por ciento basta para una barra
  if (ultimoAncho.get(el) === v) return;
  ultimoAncho.set(el, v);
  el.style.width = `${v}%`;
}

const _adelante = new THREE.Vector2(), _derecha = new THREE.Vector2(), _dir = new THREE.Vector2();
function actualizarCombateJugador(dt) {
  jugador.golpeCooldown -= dt;
  jugador.invulnerable -= dt;

  if (jugador.golpePendiente >= 0) {
    jugador.golpePendiente -= dt;
    if (jugador.golpePendiente < 0) resolverGolpe({ axel: g.axel, jugador, enemigos, sonido, vista, obj });
  }
}

function moverJugador(dt) {
  // ---- direccion de movimiento relativa a la camara
  const adelante = _adelante.set(-Math.sin(vista.yaw), -Math.cos(vista.yaw));   // vectores reutilizados: nada de crear objetos cada cuadro
  const derecha = _derecha.set(Math.cos(vista.yaw), -Math.sin(vista.yaw));
  let ix = 0, iz = 0;
  if (jugador.vivo && !g.dialogo) {
    if (teclas["w"]) iz += 1;
    if (teclas["s"]) iz -= 1;
    if (teclas["d"]) ix += 1;
    if (teclas["a"]) ix -= 1;
    if (teclas["arrowleft"]) vista.yaw += 1.8 * dt;
    if (teclas["arrowright"]) vista.yaw -= 1.8 * dt;
    if (teclas["arrowup"]) vista.pitch = Math.max(-0.15, vista.pitch - 1.2 * dt);
    if (teclas["arrowdown"]) vista.pitch = Math.min(1.15, vista.pitch + 1.2 * dt);
    if (g.tactil) { ix += g.tactil.mov.x; iz += g.tactil.mov.y; }     // joystick en pantalla
  }

  const dir = _dir.set(0, 0)
    .addScaledVector(adelante, iz)
    .addScaledVector(derecha, ix);
  const moviendo = dir.lengthSq() > 0;
  if (moviendo) dir.normalize();

  const correr = teclas["shift"] || (g.tactil && g.tactil.correr);
  const vAgua = g.mundo.agua ? g.mundo.agua.velocidad : null;   // cada masa de agua tiene su ritmo
  const rapidez = moviendo ? (jugador.nadando ? (correr ? vAgua.rapido : vAgua.nadar) : correr ? 6.4 : 3.4) : 0;
  const k = Math.min(1, dt * (moviendo ? 12 : 9));
  jugador.vel.x += (dir.x * rapidez - jugador.vel.x) * k;
  jugador.vel.z += (dir.y * rapidez - jugador.vel.z) * k;

  // ---- mover (no se puede entrar al mar)
  const nx = jugador.pos.x + jugador.vel.x * dt;
  const nz = jugador.pos.z + jugador.vel.z * dt;
  if (g.mundo.dentroDelMapa(nx, nz)) {          // el mar se nada hasta el limite del mapa
    jugador.pos.x = nx;
    jugador.pos.z = nz;
  } else if (g.mundo.dentroDelMapa(nx, jugador.pos.z)) {
    jugador.pos.x = nx;
  } else if (g.mundo.dentroDelMapa(jugador.pos.x, nz)) {
    jugador.pos.z = nz;
  } else if (!g.metaLista && g.tiempo > avisoMar) {
    avisoMar = g.tiempo + 5;
    decir(g.mundo.tema.limiteTexto, 4);
  }
  g.mundo.resolver(jugador.pos, 0.42);

  // ---- salto y gravedad
  const suelo = g.mundo.altura(jugador.pos.x, jugador.pos.z);
  const estabaNadando = jugador.nadando;
  // histeresis: entra al agua con fondo > 0.45 m y sale con menos de 0.15 m (evita parpadeos en la orilla)
  jugador.nadando = g.mundo.agua ? g.mundo.agua.contiene(jugador.pos.x, jugador.pos.z, estabaNadando) : false;
  if (estabaNadando && !jugador.nadando) sonido.chapoteo(0.5);   // sale del agua
  if (jugador.nadando) {
    // en el agua se flota: sin gravedad ni salto
    if (!estabaNadando) sonido.chapoteo(1);
    jugador.vy = 0;
    jugador.enSuelo = true;
    // el cuerpo tendido flota con la espalda a ras de la ola (sigue su altura real)
    const objetivoY = g.mundo.agua.superficie(jugador.pos.x, jugador.pos.z, g.tiempo) - g.mundo.agua.flotacion;
    jugador.pos.y += (objetivoY - jugador.pos.y) * Math.min(1, dt * 14);
  } else {
  if (jugador.enSuelo && (teclas[" "] || (g.tactil && g.tactil.saltar)) && jugador.vivo) {
    jugador.vy = 7.2;
    jugador.enSuelo = false;
    sonido.salto();
  }
  jugador.vy -= 19 * dt;
  jugador.pos.y += jugador.vy * dt;
  if (jugador.pos.y <= suelo) {
    if (!jugador.enSuelo && jugador.vy < -6) sonido.aterrizaje(Math.min(1.6, -jugador.vy / 9));   // mas fuerte si cae de mas alto
    jugador.pos.y = suelo;
    jugador.vy = 0;
    jugador.enSuelo = true;
  } else if (jugador.pos.y > suelo + 0.15) {
    jugador.enSuelo = false;
  }
  }
}

function actualizarAnimacionJugador(dt) {
  // ---- orientacion y animacion
  const velocidadH = Math.hypot(jugador.vel.x, jugador.vel.z);
  if (jugador.vivo) {
    if (jugador.golpePendiente >= 0 || g.axel.golpeT >= 0) {
      g.axel.mirarHacia(vista.yaw + Math.PI, dt, 18); // al pelear mira hacia donde apunta la camara
    } else if (velocidadH > 0.3) {
      g.axel.mirarHacia(Math.atan2(jugador.vel.x, jugador.vel.z), dt);
    }
  }
  g.axel.grupo.position.copy(jugador.pos);
  g.axel.actualizar(dt, velocidadH, jugador.enSuelo, g.tiempo, jugador.vy, jugador.nadando && g.mundo.agua.tipo,   // "mar" = crol, "oasis" = braza
      // sombrero: lo decide el inventario (no en la montaña; se lo pone tras la cinematica)
      inventario.modoSombrero({ permitido: g.mundo.tema.sombrero !== false, tiene: g.nivel > 0 || cinematicasVistas.has(0) }));

  // pasos sincronizados con las piernas
  const medioPaso = Math.floor(g.axel.fase / Math.PI);
  if (medioPaso !== pasoAnterior) {
    pasoAnterior = medioPaso;
    if (jugador.enSuelo && !jugador.nadando && velocidadH > 1) sonido.paso(superficiePaso(), velocidadH > 4.8);
  }
  // brazadas al nadar (una cada ~0.6 s, mas seguidas si nada rapido)
  if (jugador.nadando && velocidadH > 0.4 && g.tiempo > proximaBrazada) {
    proximaBrazada = g.tiempo + (velocidadH > 2.5 ? 0.45 : 0.7);
    sonido.brazada();
  }
  return velocidadH;
}

// Superficie bajo los pies de Max, para que los pasos suenen distinto en arena, pasto o nieve
function superficiePaso() {
  const tipo = g.mundo.tema.tipo, y = jugador.pos.y;
  if (tipo === "desierto") return "arena";
  if (tipo === "montana") return y >= 6 ? "nieve" : "pasto";
  return y < 0.9 ? "arena" : "pasto";      // isla: arena junto al agua, pasto tierra adentro
}

// 0..1: 1 si Max esta en el agua, baja hasta 0 a ~22 m de la orilla mas cercana
const DIRS_AGUA = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
function cercaniaAgua() {
  const { x, z } = jugador.pos;
  if (jugador.nadando || g.mundo.altura(x, z) < g.mundo.agua.nivel) return 1;
  for (let d = 2; d <= 22; d += d < 8 ? 2 : 4) {
    for (const [dx, dz] of DIRS_AGUA) {
      if (g.mundo.altura(x + dx * d, z + dz * d) < g.mundo.agua.nivel) return 1 - d / 24;
    }
  }
  return 0;
}

function actualizarEntornoJugador(dt) {
  // ---- fogata: da calor (ya no cura; la vida se recupera con botiquines)
  let dFuego = Infinity;                       // el sonido sigue al fuego mas cercano (las antorchas suenan menos)
  for (const f of g.mundo.fuegos) {
    const d = Math.hypot(jugador.pos.x - f.grupo.position.x, jugador.pos.z - f.grupo.position.z);
    dFuego = Math.min(dFuego, d / (f.escala >= 1 ? 1 : 0.6));
  }
  sonido.ajustarFuego(dFuego);
  if (g.tiempo > proximoSondeoAgua) {            // cercania al agua: se busca la orilla en 8 direcciones
    proximoSondeoAgua = g.tiempo + 0.2;
    sonido.ajustarAgua(g.mundo.agua ? g.mundo.agua.tipo : null, g.mundo.agua ? cercaniaAgua() : 0);
  }

  // ---- frio de la montaña: sin calor te congelas y pierdes vida
  const congelaba = frio.congelando;
  const danoFrio = frio.actualizar(dt, frio.cercaDelFuego(jugador.pos, g.mundo.fuegos));
  if (jugador.vivo && danoFrio > 0) {
    jugador.vida = Math.max(0, jugador.vida - danoFrio * dt);
    hud.dano.style.opacity = 0.3;
    if (jugador.vida <= 0) matarJugador();
  } else if (congelaba) {
    hud.dano.style.opacity = 0;
  }
  if (frio.activo && frio.frio > 60 && g.tiempo > avisoFrio) {
    avisoFrio = g.tiempo + 12;
    decir("¡Te estás congelando! Acércate a una fogata o antorcha.", 4);
  }

  suministros.actualizar(dt, g.tiempo, g.mundo, g.axel);   // botiquines y kits de arma
}

function actualizarObjetivosJugador(dt, velocidadH) {
  // ---- idolos
  let mas = Infinity;
  for (const id of g.mundo.idolos) {
    if (id.recogido) continue;
    const d = Math.hypot(jugador.pos.x - id.x, jugador.pos.z - id.z);
    mas = Math.min(mas, d);
    if (d < 1.5 && jugador.vivo) {
      id.recogido = true;
      id.obj.visible = id.brillo.visible = false;
      id.luz.intensity = 0;
      obj.idolos++;
      sonido.recoger();
      decir(`Ídolo recogido (${obj.idolos}/${IDOLOS_POR_NIVEL})`, 2.5);
    }
  }

  // ---- objetivos sencillos: fogata, altar y nado
  if (g.mundo.fogata && Math.hypot(jugador.pos.x - g.mundo.fogata.x, jugador.pos.z - g.mundo.fogata.z) < 3.4) obj.fogata = true;
  if (Math.hypot(jugador.pos.x - g.mundo.altar.x, jugador.pos.z - g.mundo.altar.z) < 4.2) obj.altar = true;
  if (jugador.nadando && g.mundo.agua.tipo === "oasis") obj.nado += velocidadH * dt;   // solo cuenta nadar en el oasis

  const lista = objetivos(g.nivel, obj);
  if (!g.metaLista && g.misionesAceptadas && lista.every(([, ok]) => ok)) {
    g.metaLista = true;
    g.mundo.activarAltar();
    g.mundo.mostrarPortal(g.mundo.salida.x, g.mundo.salida.z, g.mundo.tema.vehiculo);
    sonido.recoger();
    decir("¡Objetivos cumplidos! " + g.mundo.tema.salidaTexto, 7);
  }
  pintarObjetivos(g.misionesAceptadas ? lista : [["Habla con Daniel (T) para recibir tus misiones", false]]);
}

function actualizarIndicadoresJugador(dt) {
  // Daniel mira a Axel y avisa cuando esta cerca
  const dDaniel = Math.hypot(jugador.pos.x - danielPos.x, jugador.pos.z - danielPos.z);
  g.daniel.mirarHacia(Math.atan2(jugador.pos.x - danielPos.x, jugador.pos.z - danielPos.z), dt, 6);
  avisoHablar.style.display = dDaniel < 3.6 && !g.dialogo && jugador.vivo && !g.tactil ? "block" : "none";
  g.tactil?.mostrarHablar(jugador.vivo && (dDaniel < 3.6 || !!g.dialogo));
  g.tactil?.textoGolpe(jugador.arma?.tipo === "pistola" ? "DISPARAR" : "GOLPEAR");
  if (g.metaLista) {
    const dMeta = Math.hypot(jugador.pos.x - g.mundo.portal.x, jugador.pos.z - g.mundo.portal.z);
    ponerTexto(hud.pista, `Salida: ${Math.round(dMeta)} m`);
    revisarPortal();
  } else if (!g.misionesAceptadas) {
    ponerTexto(hud.pista, `Daniel: ${Math.round(dDaniel)} m`);
  } else {
    let mas = Infinity;
    for (const id of g.mundo.idolos) {
      if (!id.recogido) mas = Math.min(mas, Math.hypot(jugador.pos.x - id.x, jugador.pos.z - id.z));
    }
    const nadoPendiente = NIVELES[g.nivel].extras.includes("nadar") && obj.nado < METROS_NADO;
    if (nadoPendiente && g.mundo.oasis && obj.idolos >= IDOLOS_POR_NIVEL) {
      ponerTexto(hud.pista, `Oasis: ${Math.round(Math.hypot(jugador.pos.x - g.mundo.oasis.x, jugador.pos.z - g.mundo.oasis.z))} m`);
    } else {
      ponerTexto(hud.pista, mas < Infinity ? `Ídolo más cercano: ${Math.round(mas)} m` : "");
    }
  }
}

function actualizarHudJugador() {
  // ---- HUD
  ponerAncho(hud.barraVida, jugador.vida);
  hud.barraVida.classList.toggle("baja", jugador.vida < 35);
  if (frio.activo) {
    ponerAncho(hud.barraFrio, frio.frio);
    hud.barraFrio.classList.toggle("critico", frio.frio > 60);
    ponerAncho(hud.barraCalor, frio.calor);
  }
}

export function actualizarJugador(dt) {
  actualizarCombateJugador(dt);
  moverJugador(dt);
  const velocidadH = actualizarAnimacionJugador(dt);
  actualizarEntornoJugador(dt);
  actualizarObjetivosJugador(dt, velocidadH);
  actualizarIndicadoresJugador(dt);
  actualizarHudJugador();
}

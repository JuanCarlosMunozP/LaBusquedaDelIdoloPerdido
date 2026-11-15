// Suministros del mapa: botiquines y kits de arma. El SERVIDOR decide cuando aparece cada uno, cuanto
// dura, cuantos puede haber y que arma trae un kit (backend/app/domain/supplies.py); aqui solo se
// dibujan en el mapa, se animan y se avisa al servidor cuando Max llega hasta uno. No duran entre
// partidas: cada nivel abre una carrera nueva (reiniciar). Sin servidor no aparece ninguno.
import { crearModeloBotiquin, crearModeloKitArma } from '../escenario/botiquines.js';
import { ARMAS, equiparArma } from '../personajes/armas.js';
import { decir } from '../interfaz/hud.js';
import { reglas } from './reglas.js';
import { crearSincronizador, elegirPosicion } from './sincronizadorSuministros.js';
import * as api from '../cuenta/apiCliente.js';

const RADIO_RECOGER = 1.4;     // m
const REINTENTO_RECOGER = 2;   // s tras un fallo de red al recoger
const apiSuministros = { crear: api.crearCarreraSuministros, estado: api.estadoSuministros, reclamar: api.reclamarSuministro };

export function crearSuministros({ scene, sonido, jugador, inventario, sincronizador = crearSincronizador({ api: apiSuministros }) }) {
  const S = reglas.suministros;       // vidaMaxima y aviso (los manda el servidor)
  const objetos = new Map();          // id -> { obj, x, y, z, tipo, reclamando, reintentoEn }
  let mundoActual = null;

  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;left:18px;bottom:14px;padding:6px 14px;border-radius:20px;" +
    "background:rgba(22,14,18,.6);color:#ffd98a;font-size:14px;z-index:3;display:none";
  document.body.appendChild(panel);
  const pintarPanel = () => {
    panel.style.display = jugador.arma ? "block" : "none";
    if (jugador.arma) {
      panel.textContent = jugador.arma.tipo === "pistola"
        ? `Arma: ${jugador.arma.id} · ${jugador.municion} balas` : `Arma: ${jugador.arma.id}`;
    }
  };

  // ---- dibujar en el mapa lo que dice el servidor
  // un punto sirve si es tierra firme dentro del mapa, lejos de Max y de los obstaculos
  const puntoValido = (mundo) => (x, z) => {
    const y = mundo.altura(x, z);
    if (y < 0.6 || !mundo.dentroDelMapa(x, z)) return null;
    if (Math.hypot(x - jugador.pos.x, z - jugador.pos.z) < 5) return null;
    if (mundo.obstaculos.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1)) return null;
    return { y };
  };

  function colocar(item) {
    const p = elegirPosicion(item.candidatos, mundoActual.tema.limite, puntoValido(mundoActual));
    if (!p) return;                                   // ninguna posicion sirvio: no se dibuja (caduca solo)
    const obj = item.tipo === "botiquin" ? crearModeloBotiquin() : crearModeloKitArma();
    obj.position.set(p.x, p.y + 0.5, p.z);
    scene.add(obj);
    objetos.set(item.id, { obj, ...p, tipo: item.tipo, reclamando: false, reintentoEn: 0 });
  }

  function quitar(id) {
    const o = objetos.get(id);
    if (!o) return;
    scene.remove(o.obj);
    objetos.delete(id);
  }

  // ---- armas
  function tomarArma(axel, premio) {
    const arma = ARMAS[premio.arma];
    if (!arma) return;
    const guardada = inventario?.guardarActual(jugador);      // la que llevaba va a la mochila
    jugador.arma = arma;
    jugador.municion = premio.municion;
    sincronizarArma(axel);
    inventario?.marcarCambio();
    decir(guardada ? `Kit de arma: ${arma.id} (la anterior va a la mochila)` : `Kit de arma: ${arma.id}`, 3);
  }

  // Muestra en la mano de Max el arma que dice `jugador` (tras recoger, cambiar o guardar desde el inventario)
  function sincronizarArma(axel) {
    const arma = jugador.arma;
    equiparArma(axel, arma ?? { crear: null });
    axel.apuntando = arma?.tipo === "pistola" ? 1 : 0;     // con pistola lleva el brazo extendido
    pintarPanel();
  }

  // la llama main.js al disparar: gasta una bala y suelta la pistola cuando se acaban
  function gastarBala(axel) {
    if (jugador.municion > 0) { pintarPanel(); inventario?.marcarCambio(); return; }
    equiparArma(axel, { crear: null });
    axel.apuntando = 0;
    jugador.arma = null;
    decir("Sin balas: guardas la pistola", 3);
    pintarPanel();
    inventario?.marcarCambio();
  }

  function quitarArma(axel) {
    if (axel) { equiparArma(axel, { crear: null }); axel.apuntando = 0; }
    jugador.arma = null;
    jugador.municion = 0;
    pintarPanel();
  }

  // ---- recoger: el servidor valida y decide la recompensa
  function recoger(id, o, axel, tiempo) {
    if (o.tipo === "botiquin" && jugador.vida >= S.vidaMaxima) return;   // con la vida llena lo deja para despues
    o.reclamando = true;
    sincronizador.reclamar(id).then((r) => {
      if (r.ok && jugador.vivo) {
        if (r.recompensa.tipo === "botiquin") {
          jugador.vida = Math.min(S.vidaMaxima, jugador.vida + r.recompensa.curacion);
          decir(`Botiquín: +${r.recompensa.curacion} de vida`, 2.5);
          sonido.recogerBotiquin();
        } else {
          tomarArma(axel, r.recompensa);
          sonido.recogerArma();
        }
      }
      if (r.ok || r.perdido) quitar(id);            // recogido, o alguien/algo se lo llevo antes
      else { o.reclamando = false; o.reintentoEn = tiempo + REINTENTO_RECOGER; }
    });
  }

  function reiniciar() {
    for (const id of [...objetos.keys()]) quitar(id);
    sincronizador.reiniciar();
  }

  function actualizar(dt, tiempo, mundo, axel) {
    mundoActual = mundo;
    if (sincronizador.debeSincronizar()) {
      sincronizador.sincronizar().then((cambios) => {
        if (!cambios || mundoActual !== mundo) return;     // respuesta de un nivel anterior
        cambios.quitados.forEach(quitar);
        cambios.nuevos.forEach(colocar);
      });
    }
    for (const [id, o] of [...objetos]) {
      const item = sincronizador.items.get(id);
      if (!item || sincronizador.tiempo() >= item.expira) { quitar(id); continue; }
      o.obj.rotation.y = tiempo * 1.2 + id;
      o.obj.position.y = o.y + 0.5 + Math.sin(tiempo * 2 + id) * 0.08;
      o.obj.visible = sincronizador.visible(item, S.aviso);
      if (o.reclamando || tiempo < o.reintentoEn || !jugador.vivo) continue;
      if (Math.hypot(jugador.pos.x - o.x, jugador.pos.z - o.z) <= RADIO_RECOGER) recoger(id, o, axel, tiempo);
    }
  }

  return { actualizar, reiniciar, gastarBala, quitarArma, sincronizarArma };
}

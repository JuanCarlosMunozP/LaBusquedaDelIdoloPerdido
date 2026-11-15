// Ciclo de la partida: pausa, muerte del jugador, escena final y fin del juego.
import { montarEscenaFinal } from '../escenario/casa.js';
import { hud, cajaDialogo, avisoHablar, pantallaFinal } from '../interfaz/hud.js';
import { dispositivo } from '../interfaz/dispositivo.js';
import * as cuenta from '../cuenta/cuenta.js';
import { NIVELES } from './datos.js';
import { g, jugador, enemigos } from './estadoJuego.js';
import { scene } from './escena.js';
import { sonido, gltfLoader } from './servicios.js';

export function pausar() {
  g.estado = "pausa";
  hud.titulo.textContent = "PAUSA";
  hud.texto.textContent = dispositivo.tactil ? "Toca para continuar." : "Haz clic para continuar.";
  hud.boton.textContent = "Continuar";
  hud.pantalla.classList.remove("oculta");
}

export function matarJugador(empuje) {
  if (!jugador.vivo) return;
  jugador.vivo = false;
  g.axel.morir(undefined, empuje);                       // al morir, axel.alMorir suelta arma y sombrero
  sonido.derrota();
  setTimeout(() => terminar("derrota"), 1500);
}

// Escena final: Max descansa en su cabaña mientras la camara gira alrededor, como en el menu.
async function irACasa() {
  for (const o of g.mundo.objetos) o.visible = false;
  for (const e of enemigos) scene.remove(e.humano.grupo);
  enemigos.length = 0;
  if (g.daniel) scene.remove(g.daniel.grupo);
  cajaDialogo.style.display = avisoHablar.style.display = "none";
  g.mundo.ocultarPortal();
  jugador.pos.set(5000, 0, 5000 - 0.9);
  g.axel.grupo.position.set(5000, 0, 5000);
  await montarEscenaFinal({ scene, gltfLoader, jugador, axel: g.axel });
}

export function terminar(resultado) {
  if (g.estado === "victoria" || g.estado === "derrota") return;
  g.estado = resultado;
  document.exitPointerLock?.();
  const segundos = Math.round(g.tiempoFinal);
  if (resultado === "victoria") {
    sonido.victoria();
    irACasa();
    cuenta.registrarVictoria(segundos);          // mejor tiempo y progreso de la cuenta
  }
  pantallaFinal(resultado, segundos, NIVELES.length);
}

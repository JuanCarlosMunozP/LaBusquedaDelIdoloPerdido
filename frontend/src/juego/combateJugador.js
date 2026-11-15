// Combate del jugador: golpear o disparar, recibir daño y soltar objetos al morir.
import { DURACION_GOLPE, INSTANTE_IMPACTO } from '../personajes/personaje.js';
import { hud, decir } from '../interfaz/hud.js';
import { dispararJugador } from './combate.js';
import { g, jugador, enemigos, obj } from './estadoJuego.js';
import { scene } from './escena.js';
import { sonido, vista, suministros, inventario, objetosSueltos } from './servicios.js';
import { matarJugador } from './ciclo.js';

export function atacar() {
  if (!jugador.vivo || jugador.golpeCooldown > 0 || jugador.nadando) return;
  if (jugador.arma?.tipo === "pistola") {      // con pistola dispara en vez de golpear
    jugador.golpeCooldown = 0.35;
    dispararJugador({ axel: g.axel, jugador, enemigos, sonido, vista, obj, scene, mundo: g.mundo });
    suministros.gastarBala(g.axel);
    return;
  }
  if (jugador.arma) g.axel.brazoGolpe = "I";     // golpea con la mano derecha, donde lleva el arma
  if (!g.axel.golpear()) return;
  jugador.golpeCooldown = DURACION_GOLPE + 0.05;
  jugador.golpePendiente = INSTANTE_IMPACTO; // el puño conecta cuando el brazo se estira
  sonido.golpe(jugador.arma?.id);   // el sonido del golpe cambia segun el arma
}

// `mortal`: balazo en cabeza o pecho (mata al instante, aunque este invulnerable); `zona`: donde pego
// `empuje`: hacia donde empuja el ataque (decide como cae); `herida`: { parte, lado } para la animacion de dolor
export function danar(cantidad, mortal = false, zona = "", empuje = null, herida = null) {
  if (!jugador.vivo || g.cambiandoNivel || g.dialogo || g.estado !== "jugando" || (jugador.invulnerable > 0 && !mortal)) return;
  if (zona) decir(`Disparo en ${zona}`, 2);
  jugador.vida = mortal ? 0 : Math.max(0, jugador.vida - cantidad);
  jugador.invulnerable = 0.6;
  g.axel.destello(0.2, empuje);   // el cuerpo reacciona segun por donde llega el golpe
  sonido.dolor();
  vista.sacudida = 0.3;
  hud.dano.style.opacity = 1;
  setTimeout(() => (hud.dano.style.opacity = 0), 250);

  if (jugador.vida <= 0) matarJugador(empuje);   // cae segun por donde le llego el ataque
  else if (herida) g.axel.herir(herida.parte, herida.lado);
}

// Al morir, Max suelta lo que lleva a la vista: el arma de la mano y el sombrero (si no lo tenia guardado)
export function soltarObjetosDeMax(empuje) {
  g.axel.apuntando = 0;                                  // baja el brazo antes de soltar la pistola
  const arma = g.axel.armaMalla;
  if (arma) {
    g.axel.armaMalla = null;
    objetosSueltos.soltar(arma, { tipo: "arma", grosor: 0.035, impulso: empuje, fuerza: 1.8 });
  }
  const sombrero = g.axel.soltarSombrero();
  if (sombrero) objetosSueltos.soltar(sombrero, { tipo: "sombrero", grosor: 0.012, impulso: empuje, fuerza: 1.2 });
  // el arma soltada se pierde; la mochila y el estado del sombrero se conservan
  if (jugador.arma) { suministros.quitarArma(null); inventario.guardarAhora(); }
}

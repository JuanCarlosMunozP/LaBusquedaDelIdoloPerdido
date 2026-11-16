// Recarga de la pistola de Max. La pistola tiene un cargador de BALAS_POR_CARGADOR; `jugador.municion`
// sigue siendo el total que lleva (cargador + reserva), asi el inventario y los kits no cambian.
// Al vaciarse el cargador se recarga sola; la tecla R recarga antes. Mientras recarga no puede disparar.
import { BALAS_POR_CARGADOR as TAM, DURACION_RECARGA } from '../personajes/armas.js';
import { g, jugador } from './estadoJuego.js';
import { sonido, suministros } from './servicios.js';

let t = -1;               // segundos de recarga transcurridos, -1 = no esta recargando
let armaAlIniciar = null;

export const recargando = () => t >= 0;

// Balas listas en el cargador (se ajusta si cambio el total, p. ej. al cambiar de arma)
export function balasEnCargador() {
  if (jugador.arma?.tipo !== "pistola") return 0;
  if (jugador.cargador == null || jugador.cargador > jugador.municion) jugador.cargador = Math.min(TAM, jugador.municion);
  return jugador.cargador;
}

export function cancelarRecarga() {
  t = -1;
  armaAlIniciar = null;
  jugador.recargando = false;
  if (g.axel) g.axel.recarga = 0;
}

// Devuelve true si empezo a recargar (hace falta pistola, balas de reserva y un cargador sin llenar)
export function iniciarRecarga() {
  if (t >= 0 || !jugador.vivo || jugador.nadando || g.dialogo || jugador.arma?.tipo !== "pistola") return false;
  const enCargador = balasEnCargador();
  if (enCargador >= TAM || jugador.municion <= enCargador) return false;
  t = 0;
  jugador.recargando = true;
  armaAlIniciar = jugador.arma;
  suministros.refrescarPanel();
  sonido.recargar(DURACION_RECARGA);
  return true;
}

// Se llama cada cuadro desde el combate del jugador
export function actualizarRecarga(dt) {
  if (t < 0) return;
  if (!jugador.vivo || jugador.nadando || jugador.arma !== armaAlIniciar) { cancelarRecarga(); return; }
  t += dt;
  if (t >= DURACION_RECARGA) {
    jugador.cargador = Math.min(TAM, jugador.municion);
    cancelarRecarga();
    suministros.refrescarPanel();
    return;
  }
  g.axel.recarga = Math.max(0.001, t / DURACION_RECARGA);
}

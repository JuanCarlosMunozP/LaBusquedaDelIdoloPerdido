// Jugar de nuevo (tecla R o boton tras victoria/derrota) sin cerrar la sesion: la sesion real vive en
// una cookie del servidor, asi que basta recargar la pagina y entrar directo al juego. Se recuerdan el
// modo elegido y si se juega como invitado (que no tiene cookie) para no volver a pedir login ni modo.
import * as cuenta from '../cuenta/cuenta.js';
import { g } from './estadoJuego.js';

const CLAVE = "reinicioPartida";

export function reiniciarPartida(modo) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ modo: modo ?? "solo", sala: g.codigoSala || null, invitado: cuenta.esInvitado() }));
  } catch { /* sin almacenamiento: se vuelve a la portada */ }
  location.reload();
}

// Devuelve los datos del reinicio pendiente (y los consume) o null.
export function leerReinicio() {
  try {
    const v = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

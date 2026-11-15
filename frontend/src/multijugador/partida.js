// Una partida en linea: conecta con la sala, manda el estado propio y dibuja a los demas.
// El juego (main.js) solo da una foto de su jugador (`foto`) y recibe avisos; todo lo demas vive aqui.
import { crearRed, urlSala } from './red.js';
import { crearRemotos } from './remotos.js';

// foto() -> { x, y, z, ry, nadando, golpe, vida, arma, sombrero, nivel }
// avisar(texto) muestra un mensaje; corregir(x, y, z) devuelve al jugador a la ultima posicion que el servidor dio por buena
export function crearPartida({ scene, crearHumano, foto, avisar = () => {}, corregir = () => {}, loc = globalThis.location, fabricaRed = crearRed }) {
  const remotos = crearRemotos({ scene, crearHumano });
  let red = null;
  let miId = null;
  let codigo = null;

  function alMensaje(msg) {
    switch (msg.t) {
      case "sala":
        miId = msg.tuId;
        codigo = msg.codigo;
        for (const j of msg.jugadores ?? []) if (j.id !== miId) remotos.aplicar(j);
        avisar(`Sala ${codigo}: ${(msg.jugadores ?? []).length} de ${msg.max} jugadores`);
        break;
      case "entra":
        if (msg.jugador && msg.jugador.id !== miId) {
          remotos.aplicar(msg.jugador);
          avisar(`${msg.jugador.nombre} se unió a la partida`);
        }
        break;
      case "estado":
        if (msg.jugador && msg.jugador.id !== miId) remotos.aplicar(msg.jugador);
        break;
      case "sale":
        remotos.quitar(msg.id);
        break;
      case "corregir":
        corregir(msg.x, msg.y, msg.z);
        break;
      case "error":
        avisar(String(msg.mensaje ?? "No se pudo entrar a la sala."));
        break;
    }
  }

  return {
    get codigo() { return codigo; },
    get activa() { return red !== null; },
    remotos,

    conectar(codigoSala) {
      this.cerrar();
      red = fabricaRed({
        url: urlSala(loc, codigoSala),
        alMensaje,
        alCerrar: () => {
          remotos.vaciar();
          if (red) avisar("Se perdió la conexión con la sala.");
          red = null;
          miId = null;
        }
      });
      red.conectar();
    },

    // En cada cuadro: manda mi estado (red.js lo limita a ~10 por segundo) y mueve a los demas
    actualizar(dt, tiempo, nivel) {
      if (!red) return;
      red.enviarEstado(foto());
      remotos.actualizar(dt, tiempo, nivel);
    },

    cerrar() {
      if (red) { const r = red; red = null; r.cerrar(); }
      remotos.vaciar();
      miId = null;
      codigo = null;
    }
  };
}

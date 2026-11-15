// Inventario de Max: el estado del sombrero y del arma vive AQUI, no se deduce cada cuadro.
// Asi lo que el jugador decide (guardar el sombrero) se mantiene al morir, al cambiar de nivel y al
// recargar la pagina. Sin dependencias de Three.js para poder probarlo solo.
//
//   sombrero: "puesto" | "guardado"   (lo que eligio el jugador; solo importa cuando ya tiene el sombrero)
//   arma:     la que lleva en la mano (jugador.arma) | mochila: armas que guardo para cambiarlas despues
const CLAVE = "idolo.inventario.v1";
const ESTADOS = ["puesto", "guardado"];
export const MAX_MOCHILA = 3;

function almacen() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function crearInventario(storage = almacen()) {
  let sombrero = "puesto";
  try {
    const guardado = JSON.parse(storage?.getItem(CLAVE) ?? "null");
    if (guardado && ESTADOS.includes(guardado.sombrero)) sombrero = guardado.sombrero;
  } catch { /* datos corruptos o sin acceso: se parte del valor por defecto */ }

  const guardar = () => {
    try { storage?.setItem(CLAVE, JSON.stringify({ sombrero })); } catch { /* modo privado: solo dura la partida */ }
  };

  // Mochila: armas guardadas { arma, municion }. No se guarda entre partidas (como el arma en la mano).
  const mochila = [];

  return {
    get sombrero() { return sombrero; },
    mochila,

    // Guarda en la mochila el arma que lleva `jugador` (si lleva alguna). Si esta llena, se pierde la mas vieja.
    guardarActual(jugador) {
      if (!jugador.arma) return false;
      mochila.push({ arma: jugador.arma, municion: jugador.municion });
      while (mochila.length > MAX_MOCHILA) mochila.shift();
      jugador.arma = null;
      jugador.municion = 0;
      return true;
    },

    // Cambia el arma en la mano por la que esta en `indice` de la mochila (la actual ocupa su lugar).
    cambiarArma(jugador, indice) {
      const nueva = mochila[indice];
      if (!nueva) return false;
      const actual = jugador.arma ? { arma: jugador.arma, municion: jugador.municion } : null;
      if (actual) mochila[indice] = actual; else mochila.splice(indice, 1);
      jugador.arma = nueva.arma;
      jugador.municion = nueva.municion;
      return true;
    },

    // Guarda el arma de la mano y deja los puños libres
    guardarEnMano(jugador) {
      return mochila.length < MAX_MOCHILA && this.guardarActual(jugador);
    },

    vaciarMochila() { mochila.length = 0; },

    // Poner o guardar el sombrero. Devuelve el estado final.
    fijarSombrero(estado) {
      if (!ESTADOS.includes(estado)) return sombrero;
      sombrero = estado;
      guardar();
      return sombrero;
    },
    alternarSombrero() { return this.fijarSombrero(sombrero === "puesto" ? "guardado" : "puesto"); },

    // Que muestra el modelo. Regla unica y sin efectos secundarios:
    //   sin sombrero aun (antes de la cinematica) -> en la mano | nivel sin sombrero -> oculto
    //   guardado -> oculto (NUNCA reaparece solo) | puesto -> cabeza (el modelo lo pasa a la mano al nadar)
    modoSombrero({ tiene, permitido }) {
      if (!permitido) return "oculto";
      if (!tiene) return "mano";
      return sombrero === "guardado" ? "oculto" : "cabeza";
    }
  };
}

// Inventario de Max: el estado del sombrero y del arma vive AQUI, no se deduce cada cuadro.
// Asi lo que el jugador decide (guardar el sombrero) se mantiene al morir, al cambiar de nivel y al
// recargar la pagina. Sin dependencias de Three.js para poder probarlo solo.
//
//   sombrero: "puesto" | "guardado"   (lo que eligio el jugador; solo importa cuando ya tiene el sombrero)
//   arma:     la que lleva en la mano (jugador.arma) | mochila: armas que guardo para cambiarlas despues
const CLAVE = "idolo.inventario.v1";
const ESTADOS = ["puesto", "guardado"];

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

  return {
    get sombrero() { return sombrero; },

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

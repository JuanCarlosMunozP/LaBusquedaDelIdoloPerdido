// Inventario de Max: el estado del sombrero, el arma de la mano y la mochila vive AQUI, no se deduce
// cada cuadro. Asi lo que el jugador decide (guardar el sombrero) se mantiene al morir, al cambiar de
// nivel y al recargar la pagina. Sin dependencias de Three.js para poder probarlo solo.
//
//   sombrero: "puesto" | "guardado"   (lo que eligio el jugador; solo importa cuando ya tiene el sombrero)
//   arma:     la que lleva en la mano (jugador.arma) | mochila: armas que guardo para cambiarlas despues
//
// Donde se guarda (las reglas de validacion las impone el servidor, ver backend/app/domain/entities/inventory.py):
//   - con cuenta: en la base de datos, via `conectar()` (sombrero, arma de la mano y mochila)
//   - invitado: solo el sombrero, en localStorage de este navegador
const CLAVE = "idolo.inventario.v1";
const ESTADOS = ["puesto", "guardado"];
const ESPERA_GUARDADO = 600;     // ms: varios cambios seguidos (disparos, cambios de arma) se guardan juntos
export const MAX_MOCHILA = 3;
export const MAX_BALAS = 10;

function almacen() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// Un arma solo se guarda si el servidor la aceptaria: la pistola con 1..10 balas, las demas sin balas
function normalizar(arma, municion) {
  if (!arma || !arma.crear) return null;                       // los puños no son un objeto
  if (arma.tipo === "pistola") {
    const balas = Math.floor(municion);
    return balas >= 1 && balas <= MAX_BALAS ? { arma: arma.id, municion: balas } : null;
  }
  return { arma: arma.id, municion: 0 };
}

export function crearInventario(storage = almacen()) {
  let sombrero = "puesto";
  try {
    const guardado = JSON.parse(storage?.getItem(CLAVE) ?? "null");
    if (guardado && ESTADOS.includes(guardado.sombrero)) sombrero = guardado.sombrero;
  } catch { /* datos corruptos o sin acceso: se parte del valor por defecto */ }

  const mochila = [];            // [{ arma, municion }]
  let jugador = null;            // quien lleva el arma de la mano (ver ligar)
  let guardarRemoto = null;      // (datos) => void, cuando hay cuenta
  let temporizador = null;

  const datos = () => ({
    sombrero,
    enMano: jugador ? normalizar(jugador.arma, jugador.municion) : null,
    mochila: mochila.map((i) => normalizar(i.arma, i.municion)).filter(Boolean)
  });

  const guardarYa = () => {
    clearTimeout(temporizador);
    temporizador = null;
    if (guardarRemoto) { guardarRemoto(datos()); return; }
    try { storage?.setItem(CLAVE, JSON.stringify({ sombrero })); } catch { /* modo privado: solo dura la partida */ }
  };
  const avisar = () => {
    if (!guardarRemoto) { guardarYa(); return; }
    if (temporizador === null) temporizador = setTimeout(guardarYa, ESPERA_GUARDADO);
  };

  return {
    get sombrero() { return sombrero; },
    mochila,
    datos,

    // `quien` = el objeto con { arma, municion } que representa la mano de Max (jugador)
    ligar(quien) { jugador = quien; },

    // Con cuenta: carga lo guardado en el servidor y desde ahora guarda alla. `catalogo` = ARMAS por id.
    // Devuelve el arma que quedo en la mano (para mostrarla) o null.
    conectar(guardado, catalogo, guardar) {
      sombrero = ESTADOS.includes(guardado?.sombrero) ? guardado.sombrero : "puesto";
      mochila.length = 0;
      for (const i of guardado?.mochila ?? []) {
        const arma = catalogo[i.arma], item = normalizar(arma, i.municion);
        if (item && mochila.length < MAX_MOCHILA) mochila.push({ arma, municion: item.municion });
      }
      const enMano = guardado?.enMano && catalogo[guardado.enMano.arma];
      const normal = enMano && normalizar(enMano, guardado.enMano.municion);
      if (jugador) {
        jugador.arma = normal ? enMano : null;
        jugador.municion = normal ? normal.municion : 0;
      }
      guardarRemoto = guardar;
      return normal ? enMano : null;
    },

    // Avisa que cambio algo del inventario fuera de aqui (recoger un kit, gastar una bala, perder el arma)
    marcarCambio: avisar,
    guardarAhora: guardarYa,

    // Guarda en la mochila el arma que lleva `jugador` (si lleva alguna). Si esta llena, se pierde la mas vieja.
    guardarActual(quien = jugador) {
      if (!quien.arma) return false;
      mochila.push({ arma: quien.arma, municion: quien.municion });
      while (mochila.length > MAX_MOCHILA) mochila.shift();
      quien.arma = null;
      quien.municion = 0;
      avisar();
      return true;
    },

    // Cambia el arma en la mano por la que esta en `indice` de la mochila (la actual ocupa su lugar).
    cambiarArma(quien, indice) {
      const nueva = mochila[indice];
      if (!nueva) return false;
      const actual = quien.arma ? { arma: quien.arma, municion: quien.municion } : null;
      if (actual) mochila[indice] = actual; else mochila.splice(indice, 1);
      quien.arma = nueva.arma;
      quien.municion = nueva.municion;
      avisar();
      return true;
    },

    // Guarda el arma de la mano y deja los puños libres
    guardarEnMano(quien = jugador) {
      return mochila.length < MAX_MOCHILA && this.guardarActual(quien);
    },

    vaciarMochila() { mochila.length = 0; avisar(); },

    // Poner o guardar el sombrero. Devuelve el estado final.
    fijarSombrero(estado) {
      if (!ESTADOS.includes(estado)) return sombrero;
      sombrero = estado;
      avisar();
      return sombrero;
    },
    alternarSombrero() { return this.fijarSombrero(sombrero === "puesto" ? "guardado" : "puesto"); },

    // Que muestra el modelo. Regla unica y sin efectos secundarios:
    //   guardado -> oculto (NUNCA reaparece solo) | nivel sin sombrero -> oculto
    //   sin sombrero aun (antes de la cinematica) -> en la mano | puesto -> cabeza (el modelo lo pasa a la mano al nadar)
    modoSombrero({ tiene, permitido }) {
      if (!permitido) return "oculto";
      if (sombrero === "guardado") return "oculto";   // tambien antes de la cinematica: se puede guardar en la mano
      return tiene ? "cabeza" : "mano";
    }
  };
}

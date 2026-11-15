// Mezcla suave entre las poses base del personaje (reposo, caminar, aire, nado...).
// Antes la pose base se elegia con un if/else y saltaba de golpe al cambiar de estado; ahora cada
// estado tiene un peso que sube o baja de forma gradual y las poses se mezclan ponderadas.
// Es logica pura (sin Three.js ni el modelo) para poder probarla por separado.

// nado: crol en el mar | nadoOasis: braza del estanque | flotar: pataleo en el sitio |
// nadoPerro: chapoteo "de perrito" al arrancar | nadoLado: nado de costado | nadoBraza: braza lenta en el mar | nadoRapido: crol fuerte | nadoEspalda: nada boca arriba
export const ESTADOS_BASE = ["reposo", "caminar", "aire", "nado", "nadoOasis", "flotar", "nadoBraza", "nadoRapido", "nadoEspalda", "nadoPerro", "nadoLado"];

// Metodo de `posesHumano` (poses.js) que calcula cada estado.
export const POSE_DE_ESTADO = {
  reposo: "poseReposo",
  caminar: "poseCaminar",
  aire: "poseAire",
  nado: "poseNado",
  nadoOasis: "poseNadoOasis",
  flotar: "poseFlotar",
  nadoBraza: "poseNadoBraza",
  nadoRapido: "poseNadoRapido",
  nadoEspalda: "poseNadoEspalda",
  nadoPerro: "poseNadoPerro",
  nadoLado: "poseNadoLado"
};

// Un estado con menos peso que esto no se calcula (ahorra trabajo cuando ya casi no se nota).
export const PESO_MINIMO = 0.002;

export const TASA_MEZCLA = 9;        // ~0.3 s para completar una transicion
export const TASA_MEZCLA_AIRE = 18;  // el salto responde rapido

export function crearPesos() {
  const pesos = {};
  for (const e of ESTADOS_BASE) pesos[e] = 0;
  pesos.reposo = 1;
  return pesos;
}

// Acerca el peso del estado activo a 1 y los demas a 0, con una curva exponencial que no depende
// de los cuadros por segundo. Conserva suma = 1. Modifica y devuelve `pesos`.
export function actualizarPesos(pesos, activo, dt, tasa = TASA_MEZCLA) {
  const k = 1 - Math.exp(-tasa * Math.max(0, dt));
  let suma = 0;
  for (const e of ESTADOS_BASE) {
    pesos[e] += ((e === activo ? 1 : 0) - pesos[e]) * k;
    suma += pesos[e];
  }
  for (const e of ESTADOS_BASE) pesos[e] /= suma;
  return pesos;
}

// Avanza una fase acumulada (en radianes) y la mantiene en [0, 2π) para no perder precision.
// A diferencia de `tiempo * frecuencia`, un cambio de frecuencia solo cambia la VELOCIDAD de la
// fase, nunca su valor actual: no hay saltos.
export function avanzarFase(fase, dt, frecuencia) {
  const vuelta = Math.PI * 2;
  const f = (fase || 0) + dt * frecuencia;
  return ((f % vuelta) + vuelta) % vuelta;
}

// Estilo de nado segun el agua, la velocidad y si se avanza de espaldas. `previo` es el estilo del
// cuadro anterior: cada umbral tiene histeresis (HISTERESIS m/s) para que una velocidad que oscila
// justo en el limite no haga parpadear el estilo. `agua` es "mar" | "oasis".
const HISTERESIS = 0.18;
const UMBRALES = {
  flotar: 0.4,                 // por debajo se queda en el sitio
  mar: { braza: 1.9, rapido: 2.9 },
  oasis: { perro: 1.2, rapido: 2.3 }   // en el estanque la braza es el nado normal; al arrancar chapotea de perrito
};

export function estadoDeNado(agua, velocidad, atras = false, previo = null, lado = false) {
  if (velocidad < UMBRALES.flotar + (previo === "flotar" ? HISTERESIS : 0)) return "flotar";
  if (atras) return "nadoEspalda";
  if (lado) return "nadoLado";                      // avanzando de lado: nado de costado
  if (agua === "oasis" && velocidad < UMBRALES.oasis.perro + (previo === "nadoPerro" ? HISTERESIS : 0)) return "nadoPerro";
  if (agua === "oasis") return velocidad > UMBRALES.oasis.rapido - (previo === "nadoRapido" ? HISTERESIS : 0) ? "nadoRapido" : "nadoOasis";
  const { braza, rapido } = UMBRALES.mar;
  if (velocidad > rapido - (previo === "nadoRapido" ? HISTERESIS : 0)) return "nadoRapido";
  if (velocidad < braza + (previo === "nadoBraza" ? HISTERESIS : 0)) return "nadoBraza";
  return "nado";
}

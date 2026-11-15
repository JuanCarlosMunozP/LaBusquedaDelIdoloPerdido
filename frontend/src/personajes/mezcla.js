// Mezcla suave entre las poses base del personaje (reposo, caminar, aire, nado...).
// Antes la pose base se elegia con un if/else y saltaba de golpe al cambiar de estado; ahora cada
// estado tiene un peso que sube o baja de forma gradual y las poses se mezclan ponderadas.
// Es logica pura (sin Three.js ni el modelo) para poder probarla por separado.

export const ESTADOS_BASE = ["reposo", "caminar", "aire", "nado", "nadoOasis"];

// Metodo de `posesHumano` (poses.js) que calcula cada estado.
export const POSE_DE_ESTADO = {
  reposo: "poseReposo",
  caminar: "poseCaminar",
  aire: "poseAire",
  nado: "poseNado",
  nadoOasis: "poseNadoOasis"
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

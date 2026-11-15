// Constantes compartidas por personaje.js y poses.js (en un archivo aparte para no importarse en circulo).
export const ARTICULACIONES = [
  "cadera", "torso", "cabeza",
  "hombro_I", "codo_I", "hombro_D", "codo_D",
  "muslo_I", "rodilla_I", "muslo_D", "rodilla_D"
];

// Tiempos del golpe. Los valores definitivos los manda el servidor (backend/app/domain/game_rules.py) al iniciar:
// `aplicarTiemposGolpe` los cambia una sola vez y todos los modulos que los importan ven el valor nuevo
// (son "live bindings"). Los de aqui son los de siempre y solo se usan si no hay servidor.
export let DURACION_GOLPE = 0.5;
export let INSTANTE_IMPACTO = 0.25; // segundos desde que empieza el golpe hasta que conecta

// Rechaza valores imposibles (el impacto debe caer dentro del golpe); devuelve si se aplicaron.
export function aplicarTiemposGolpe(duracion, instante) {
  const valido = Number.isFinite(duracion) && Number.isFinite(instante) && duracion > 0 && instante > 0 && instante < duracion;
  if (!valido) return false;
  DURACION_GOLPE = duracion;
  INSTANTE_IMPACTO = instante;
  return true;
}

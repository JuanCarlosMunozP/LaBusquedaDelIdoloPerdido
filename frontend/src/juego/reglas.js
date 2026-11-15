// Reglas fijas del juego. El servidor es quien las define (backend/app/domain/game_rules.py); aqui solo
// se descargan y se aplican. REGLAS_POR_DEFECTO es la copia de seguridad para cuando no hay servidor
// (invitado sin conexion, desarrollo local): tiene los mismos valores, y un test comprueba que no se
// desvien de los del servidor (tests/game-rules.test.js).
import { aplicarTiemposGolpe } from '../personajes/constantes.js';
import { cargarReglasEnServidor } from '../cuenta/apiCliente.js';

export const REGLAS_POR_DEFECTO = {
  combate: { duracionGolpe: 0.5, instanteImpacto: 0.25 },
  armas: {
    "puños": { alcance: 1.55, dano: 4, golpeEnemigo: 1, espera: 1.3 },
    cuchillo: { alcance: 1.75, dano: 10, golpeEnemigo: 1.5, espera: 0.8 },
    bate: { alcance: 2.1, dano: 14, golpeEnemigo: 2.5, espera: 1.8 },
    machete: { alcance: 1.9, dano: 13, golpeEnemigo: 2, espera: 1.3 },
    pistola: { alcance: 1.55, dano: 10, golpeEnemigo: 1.5, espera: 1.7 }
  },
  balas: {
    umbrales: { cabeza: 1.55, pecho: 1.15, abdomen: 0.8, rodillaMin: 0.35, rodillaMax: 0.6, brazoLateral: 0.2 },
    dano: { brazo: 10, abdomen: 20, rodilla: 10, pierna: 10 }
  },
  suministros: { cada: 10, duracion: 60, aviso: 10, maxPorTipo: 6, balas: 10, curacion: 40, vidaMaxima: 100 }
};

// Reglas en uso (los demas modulos las leen de aqui en el momento de usarlas, no al importar)
export const reglas = structuredClone(REGLAS_POR_DEFECTO);

const esNumero = (v, minimo = -Infinity) => typeof v === "number" && Number.isFinite(v) && v > minimo;

// Mezcla lo recibido sobre las reglas en uso, ignorando lo que no tenga sentido (nunca lanza).
// `armas` = el catalogo ARMAS del juego: se actualizan alcance, dano, golpeEnemigo y espera por id.
// Devuelve true si se aplico algo del servidor.
export function aplicarReglas(datos, armas = {}) {
  if (!datos || typeof datos !== "object") return false;
  let aplicado = false;

  const c = datos.combate;
  if (c && aplicarTiemposGolpe(c.duracionGolpe, c.instanteImpacto)) {
    reglas.combate.duracionGolpe = c.duracionGolpe;
    reglas.combate.instanteImpacto = c.instanteImpacto;
    aplicado = true;
  }

  for (const [id, r] of Object.entries(datos.armas ?? {})) {
    if (!reglas.armas[id] || !r) continue;
    for (const campo of ["alcance", "dano", "golpeEnemigo", "espera"]) {
      if (!esNumero(r[campo], campo === "alcance" || campo === "espera" ? 0 : -1)) continue;
      reglas.armas[id][campo] = r[campo];
      if (armas[id]) armas[id][campo] = r[campo];
      aplicado = true;
    }
  }

  for (const grupo of ["umbrales", "dano"]) {
    for (const [k, v] of Object.entries(datos.balas?.[grupo] ?? {})) {
      if (k in reglas.balas[grupo] && esNumero(v, -1)) { reglas.balas[grupo][k] = v; aplicado = true; }
    }
  }

  for (const [k, v] of Object.entries(datos.suministros ?? {})) {
    if (k in reglas.suministros && esNumero(v, -1)) { reglas.suministros[k] = v; aplicado = true; }
  }
  return aplicado;
}

// Descarga las reglas del servidor y las aplica. Nunca bloquea ni rompe el juego: si el servidor no
// responde en `espera` ms o contesta mal, se siguen usando las reglas por defecto (devuelve false).
export async function cargarReglas(armas, { cargar = cargarReglasEnServidor, espera = 4000 } = {}) {   // `cargar` se puede cambiar en pruebas
  let temporizador;
  try {
    const r = await Promise.race([
      cargar(),
      new Promise((resolver) => { temporizador = setTimeout(() => resolver({ ok: false }), espera); })
    ]);
    return r?.ok ? aplicarReglas(r.datos, armas) : false;
  } catch {
    return false;
  } finally {
    clearTimeout(temporizador);
  }
}

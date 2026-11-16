// Recargar la pistola (Max y los mercenarios). `this.recarga` va de 0 a 1 mientras dura; la logica del
// juego lo avanza (ver juego/recarga.js y enemigo.js). Se suma sobre poseApuntar: la mano derecha
// sostiene el arma junto al pecho, la izquierda saca el cargador vacio, va al cinturon por uno nuevo,
// lo mete de un golpe y jala la corredera. Las piezas de la pistola se mueven en animarRecargaArma.
import { suave } from './ayudas.js';
import { animarRecargaArma } from './armas.js';

const L = (a, b, t) => a + (b - a) * t;

// Brazo izquierdo: [avance, hombro[0], hombro[2], codo[1]] (hombro[0] negativo = brazo al frente)
const BRAZO_I = [
  [0.14, -0.9, 0.12, -1.15],     // la mano llega al arma
  [0.34, -0.85, 0.12, -1.1],     // jala el cargador vacio hacia abajo
  [0.46, -0.25, 0.18, -1.0],     // baja al cinturon
  [0.6, -0.3, 0.18, -1.05],      // toma el cargador nuevo
  [0.74, -0.9, 0.12, -1.15],     // lo sube al arma
  [0.8, -0.95, 0.12, -1.25],     // lo mete de un golpe
  [0.9, -0.7, 0.22, -1.5],       // jala la corredera hacia atras
  [0.95, -0.9, 0.12, -1.15]      // la suelta
];

function claves(p) {
  if (p <= BRAZO_I[0][0]) return BRAZO_I[0];
  for (let i = 1; i < BRAZO_I.length; i++) {
    if (p <= BRAZO_I[i][0]) {
      const a = BRAZO_I[i - 1], b = BRAZO_I[i], t = suave(a[0], b[0], p);
      return [p, L(a[1], b[1], t), L(a[2], b[2], t), L(a[3], b[3], t)];
    }
  }
  return BRAZO_I[BRAZO_I.length - 1];
}

export function crearPosesRecarga() {
  return {
    poseRecargar(ctx) {
      const { o } = ctx;
      const p = Math.min(this.recarga || 0, 1);
      const entra = suave(0, 0.14, p) * (1 - suave(0.92, 1, p));          // derecha: junto al pecho
      const izq = suave(0.04, 0.14, p) * (1 - suave(0.94, 1, p));         // izquierda: entra y sale
      const golpe = Math.sin(suave(0.74, 0.82, p) * Math.PI) * 0.1;       // el arma salta al meter el cargador
      o.hombro_D[0] = L(o.hombro_D[0], -0.8 + golpe, entra);
      o.hombro_D[2] = L(o.hombro_D[2], -0.1, entra);
      o.codo_D[1] = L(o.codo_D[1], 1.3, entra);
      const [, h0, h2, c1] = claves(p);
      o.hombro_I[0] = L(o.hombro_I[0], h0, izq);
      o.hombro_I[2] = L(o.hombro_I[2], h2, izq);
      o.codo_I[1] = L(o.codo_I[1], c1, izq);
      o.torso[0] += 0.1 * entra;                                          // se encorva sobre el arma
      o.torso[1] = L(o.torso[1], -0.55, entra);          // abre el cuerpo para que el arma se vea de espaldas
      o.cabeza[1] = L(o.cabeza[1], 0.35, entra);
      ctx.bob -= 0.02 * entra;
      animarRecargaArma(this.armaMalla, p);
    }
  };
}

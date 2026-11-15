// Golpes sin arma de Humano ademas del directo de poses.js: gancho, uppercut, patada frontal y patada
// giratoria. Todos duran lo mismo que el directo (DURACION_GOLPE) y conectan en el mismo instante
// (la mitad del movimiento), asi el dano y los tiempos del juego no cambian. `brazoGolpe` ("D" | "I")
// elige el lado del brazo o de la pierna que golpea: se alterna en cada golpe (ver Humano.golpear).
// Convencion: muslo[0] negativo = pierna hacia adelante; rodilla[0] positivo = rodilla doblada.
import { suave } from './ayudas.js';
import { DURACION_GOLPE } from './constantes.js';

export const POSE_DE_GOLPE = {
  directo: "poseGolpe", gancho: "poseGancho", uppercut: "poseUppercut", patada: "posePatada", giratoria: "posePatadaGiratoria"
};

// Avanza el golpe y devuelve su progreso (0..1) y el lado: `lado` = +1 si golpea la derecha.
function avanzar(h, ctx) {
  if (h.congelarGolpe === undefined) h.golpeT += ctx.dt / DURACION_GOLPE;
  else h.golpeT = h.congelarGolpe;
  return { p: Math.min(h.golpeT, 1), lado: h.brazoGolpe === "D" ? 1 : -1 };
}
const terminar = (h) => { if (h.congelarGolpe === undefined && h.golpeT >= 1) h.golpeT = -1; };
// 0 -> 1 durante la preparacion, 1 en el impacto (p 0.4-0.6) y vuelve a 0 al recuperar
const pico = (p) => suave(0.1, 0.42, p) * (1 - suave(0.62, 0.95, p));
const mezcla = (a, b, t) => a + (b - a) * t;

export function crearPosesCombate() {
  return {
    // Gancho: el codo doblado barre en horizontal con un giro fuerte de cadera y torso.
    poseGancho(ctx) {
      const { o, punoObj } = ctx; const { p, lado } = avanzar(this, ctx);
      const at = lado > 0 ? "D" : "I", gu = lado > 0 ? "I" : "D";
      const k = pico(p), barre = suave(0.3, 0.5, p) * (1 - suave(0.6, 0.85, p));
      o["hombro_" + at][0] = mezcla(o["hombro_" + at][0], -1.45, k);
      o["hombro_" + at][2] = lado * mezcla(0.1, 1.15 - 0.9 * barre, k);   // el brazo se abre y barre hacia dentro
      o["codo_" + at][1] = lado * mezcla(0, 1.55, k);
      o["hombro_" + gu][0] = mezcla(o["hombro_" + gu][0], -1.0, k);        // la otra mano protege la cara
      o["codo_" + gu][1] = -lado * 1.7 * k;
      punoObj[at] = 0.3 + 0.7 * suave(0, 0.2, p);
      o.torso[1] = lado * mezcla(-0.4 * k, 0.65, barre);
      o.cadera[1] = lado * mezcla(-0.2 * k, 0.4, barre);
      o.cabeza[1] = -lado * 0.3 * barre;
      o.muslo_D[0] = -0.15 * k; o.muslo_I[0] = 0.2 * k;
      o.rodilla_D[0] = 0.2 * k; o.rodilla_I[0] = 0.25 * k;
      ctx.bob = -0.05 * k;
      terminar(this);
    },

    // Uppercut: se agacha y el puño sube desde abajo hasta la barbilla.
    poseUppercut(ctx) {
      const { o, punoObj } = ctx; const { p, lado } = avanzar(this, ctx);
      const at = lado > 0 ? "D" : "I", gu = lado > 0 ? "I" : "D";
      const agacha = suave(0.05, 0.3, p) * (1 - suave(0.4, 0.5, p));   // se hunde antes de subir
      const sube = suave(0.32, 0.5, p) * (1 - suave(0.62, 0.9, p));
      const k = pico(p);
      o["hombro_" + at][0] = mezcla(0.5 * agacha, -2.5, sube);
      o["hombro_" + at][2] = lado * 0.12 * k;
      o["codo_" + at][1] = lado * mezcla(1.3 * agacha, 0.5, sube);
      o["hombro_" + gu][0] = mezcla(o["hombro_" + gu][0], -0.9, k);
      o["codo_" + gu][1] = -lado * 1.6 * k;
      punoObj[at] = 0.3 + 0.7 * suave(0, 0.2, p);
      o.torso[0] = 0.25 * agacha - 0.18 * sube;
      o.torso[1] = lado * (-0.2 * agacha + 0.35 * sube);
      o.cadera[1] = lado * 0.2 * sube;
      o.muslo_D[0] = -0.35 * agacha; o.muslo_I[0] = -0.35 * agacha;
      o.rodilla_D[0] = 0.7 * agacha; o.rodilla_I[0] = 0.7 * agacha;
      ctx.bob = -0.14 * agacha + 0.04 * sube;
      terminar(this);
    },

    // Patada frontal: la rodilla sube y la pierna se estira al frente mientras el torso se echa atras.
    posePatada(ctx) {
      const { o } = ctx; const { p, lado } = avanzar(this, ctx);
      const pata = lado > 0 ? "D" : "I", apoyo = lado > 0 ? "I" : "D";
      const encoge = suave(0.05, 0.32, p) * (1 - suave(0.4, 0.46, p));       // rodilla arriba (preparacion)
      const estira = suave(0.36, 0.48, p) * (1 - suave(0.62, 0.9, p));       // pierna extendida
      const k = pico(p);
      o["muslo_" + pata][0] = -mezcla(1.2 * encoge, 1.55, estira);
      o["rodilla_" + pata][0] = mezcla(1.7 * encoge, 0.05, estira);
      o["muslo_" + apoyo][0] = 0.1 * k; o["rodilla_" + apoyo][0] = 0.25 * k;   // pierna de apoyo firme y flexionada
      o.torso[0] = -0.3 * k;                                                    // se echa atras para sostener la patada
      o.cadera[1] = lado * -0.2 * k;
      for (const [nom, s] of [["I", -1], ["D", 1]]) {                           // brazos abiertos para el equilibrio
        o["hombro_" + nom][0] = mezcla(o["hombro_" + nom][0], -0.8, k);
        o["hombro_" + nom][2] = s * 0.5 * k;
        o["codo_" + nom][1] = s * -1.0 * k;
      }
      ctx.bob = 0.03 * k;
      terminar(this);
    },

    // Patada giratoria: giro de cadera y pierna alta que barre de lado a lado.
    posePatadaGiratoria(ctx) {
      const { o } = ctx; const { p, lado } = avanzar(this, ctx);
      const pata = lado > 0 ? "D" : "I", apoyo = lado > 0 ? "I" : "D";
      const k = pico(p), barre = suave(0.32, 0.55, p) * (1 - suave(0.6, 0.85, p));
      o["muslo_" + pata][0] = -mezcla(0.4, 1.2, k) * k;
      o["muslo_" + pata][2] = lado * 0.95 * k;                                  // pierna abierta hacia fuera
      o["rodilla_" + pata][0] = mezcla(1.4, 0.15, barre) * k;
      o["muslo_" + apoyo][0] = 0.12 * k; o["rodilla_" + apoyo][0] = 0.35 * k;
      o.cadera[1] = lado * mezcla(-0.35 * k, 0.7, barre);
      o.torso[1] = lado * mezcla(-0.3 * k, 0.55, barre);
      o.torso[2] = -lado * 0.35 * k;                                            // se inclina al lado contrario
      for (const [nom, s] of [["I", -1], ["D", 1]]) {
        o["hombro_" + nom][0] = mezcla(o["hombro_" + nom][0], -0.5, k);
        o["hombro_" + nom][2] = s * 1.0 * k;
        o["codo_" + nom][1] = s * -0.5 * k;
      }
      o.cabeza[1] = -lado * 0.3 * barre;
      ctx.bob = 0.02 * k;
      terminar(this);
    }
  };
}

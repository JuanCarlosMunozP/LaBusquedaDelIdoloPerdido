// Estilos de nado extra de Humano (ademas del crol del mar y la braza del oasis de poses.js):
// flotar en el sitio, braza lenta en el mar, crol rapido y nado de espaldas. Usan el mismo cuadro
// `ctx` que el resto de poses. Convencion de los brazos: con el cuerpo tendido, hombro[0] negativo
// lleva el brazo por delante de la cabeza; hombro[2] positivo en "I" y negativo en "D" lo abre.
// Las fases son acumuladas (avanzarFase): cambiar de velocidad no hace saltar los brazos.
import { avanzarFase } from './mezcla.js';

const vuelta = Math.PI * 2;

export function crearPosesNado(base) {
  return {
    // Mantenerse a flote en el sitio: casi vertical, brazos que remueven el agua y piernas "en bicicleta".
    poseFlotar(ctx) {
      const { dt, o, tiempo } = ctx;
      this.faseFlotar = avanzarFase(this.faseFlotar, dt, 2.6);
      const ph = this.faseFlotar;
      for (const [nom, fuera, desfase] of [["I", 1, 0], ["D", -1, Math.PI]]) {
        const q = ph + desfase;
        o["hombro_" + nom][0] = -0.55 + 0.35 * Math.sin(q);
        o["hombro_" + nom][2] = fuera * (0.85 + 0.2 * Math.cos(q));
        o["codo_" + nom][1] = -fuera * (0.7 + 0.35 * Math.sin(q + 1));
      }
      const pedal = ph * 0.9;
      for (const [nom, fuera, desfase] of [["I", -1, 0], ["D", 1, Math.PI]]) {
        const q = pedal + desfase;
        o["muslo_" + nom][0] = -0.35 + 0.45 * Math.sin(q);
        o["muslo_" + nom][2] = fuera * 0.1;
        o["rodilla_" + nom][0] = 0.85 + 0.55 * Math.max(0, Math.cos(q));
      }
      o.torso[0] = -0.08;
      o.cabeza[0] = -0.35;
      ctx.cabeceo = -1.05;                                 // casi de pie, con la cara fuera del agua
      ctx.bob = -1.0 + 0.04 * Math.sin(ph * 2 + tiempo * 0.3);   // el cuerpo queda hundido hasta el pecho
      ctx.roll = 0.03 * Math.sin(ph);
    },

    // Braza lenta en el mar: la del estanque, algo mas incorporada y hundida.
    poseNadoBraza(ctx) {
      base.poseNadoOasis.call(this, ctx);
      ctx.cabeceo -= 0.1;
      ctx.bob -= 0.1;
    },

    // Crol rapido (Shift): brazada larga y potente, patada fuerte y cuerpo casi horizontal.
    poseNadoRapido(ctx) {
      const { velocidad, tiempo, dt, o } = ctx;
      const vf = Math.min(velocidad / 3.4, 1);
      this.faseRapido = avanzarFase(this.faseRapido, dt, 5.2 + 1.6 * vf);
      const brazada = this.faseRapido;
      for (const [nom, fuera, ph] of [["I", 1, brazada], ["D", -1, brazada + Math.PI]]) {
        const fase = Math.cos(ph), recobro = Math.max(0, Math.sin(ph));
        o["hombro_" + nom][0] = -1.15 - 1.85 * fase;
        o["hombro_" + nom][2] = fuera * (0.1 + 0.35 * recobro);
        o["codo_" + nom][1] = -fuera * (0.1 + 1.2 * recobro + 0.25 * Math.max(0, -Math.sin(ph)));
      }
      const patada = Math.sin(tiempo * 17) * (0.7 + 0.3 * vf);
      o.muslo_I[0] = 0.1 + 0.34 * patada;
      o.muslo_D[0] = 0.1 - 0.34 * patada;
      o.rodilla_I[0] = 0.12 + 0.22 * Math.max(0, -patada);
      o.rodilla_D[0] = 0.12 + 0.22 * Math.max(0, patada);
      o.torso[1] = 0.4 * Math.cos(brazada);
      o.cabeza[0] = -0.6;
      o.cabeza[1] = -0.38 * Math.cos(brazada);
      ctx.roll = 0.24 * Math.cos(brazada);                 // el cuerpo rueda con cada brazada
      ctx.cabeceo = 0.03 + 0.03 * Math.sin(brazada * 2);   // mas horizontal que el crol normal
      ctx.bob = Math.sin(brazada * 2) * 0.05;
    },

    // Nado de espaldas: boca arriba, brazos que giran por encima de la cabeza y patada suave.
    poseNadoEspalda(ctx) {
      const { velocidad, tiempo, dt, o } = ctx;
      const vf = Math.min(velocidad / 2.4, 1);
      this.faseEspalda = avanzarFase(this.faseEspalda, dt, 3.0 + 1.2 * vf);
      const brazada = this.faseEspalda;
      for (const [nom, fuera, ph] of [["I", 1, brazada], ["D", -1, brazada + Math.PI]]) {
        const u = 0.5 - 0.5 * Math.cos(ph);                // 0 = brazo junto al muslo, 1 = sobre la cabeza
        const tira = Math.max(0, -Math.sin(ph));           // al volver por el agua el brazo se abre y el codo se dobla
        o["hombro_" + nom][0] = -Math.PI * 0.95 * u;
        o["hombro_" + nom][2] = fuera * (0.12 + 0.5 * tira);
        o["codo_" + nom][1] = -fuera * 0.55 * tira;
      }
      const patada = Math.sin(tiempo * 11) * (0.5 + 0.5 * vf);
      o.muslo_I[0] = 0.08 + 0.26 * patada;
      o.muslo_D[0] = 0.08 - 0.26 * patada;
      o.rodilla_I[0] = 0.15 + 0.15 * Math.max(0, -patada);
      o.rodilla_D[0] = 0.15 + 0.15 * Math.max(0, patada);
      o.torso[1] = 0.18 * Math.cos(brazada);
      o.cabeza[0] = 0.25;
      ctx.roll = 0.14 * Math.cos(brazada);
      ctx.cabeceo = -2.9;                                  // 1.45 - 2.9: el cuerpo se tiende boca arriba
      ctx.bob = Math.sin(brazada * 2) * 0.03 - 0.05;
    }
  };
}

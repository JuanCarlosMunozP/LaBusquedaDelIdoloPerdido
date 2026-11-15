// Nado del MAR abierto: crol, crol rapido (Shift), braza lenta, de espaldas y flotar en el sitio. El
// cuerpo va medio hundido en el agua; el oasis tiene sus propias poses en posesNadoOasis.js.
import { avanzarFase } from './mezcla.js';

export function crearPosesNadoMar() {
  return {
    // Crol en el mar.
    poseNado(ctx) {
      const { velocidad, tiempo, o } = ctx;
      // crol: brazos que giran alternados, patada de tijera y cuerpo tendido sobre el agua
      // fase acumulada: ver poseNadoOasis (evita el salto de brazada al cambiar de velocidad)
      this.faseNado = avanzarFase(this.faseNado, ctx.dt, 3.2 + 1.6 * Math.min(velocidad / 3, 1));
      const brazada = this.faseNado;
      const f = 0.45 + 0.55 * Math.min(velocidad / 2.5, 1);   // en el sitio, brazadas mas suaves
      for (const [lado, nom, ph] of [[-1, "I", brazada], [1, "D", brazada + Math.PI]]) {
        const fase = Math.cos(ph), recobro = Math.max(0, Math.sin(ph));
        o["hombro_" + nom][0] = (-1.5 - 1.75 * fase) * f - 0.2 * (1 - f);   // brazada amplia: en el recobro el brazo sale del agua
        o["hombro_" + nom][2] = lado * (0.12 + 0.34 * recobro);
        // al tirar del agua (fuera del recobro) el codo se dobla un poco: agarra el agua en vez de empujarla recta
        const traccion = Math.max(0, -Math.sin(ph));
        o["codo_" + nom][1] = lado * (0.12 + 1.0 * recobro + 0.3 * traccion) * f;
      }
      const vf = Math.min(velocidad / 2.5, 1);                  // 0 = chapoteando en el sitio, 1 = nadando fuerte
      const patada = Math.sin(tiempo * 12) * (0.55 + 0.45 * vf);   // la patada se afloja al ir despacio
      o.muslo_I[0] = 0.12 + 0.28 * patada;
      o.muslo_D[0] = 0.12 - 0.28 * patada;
      o.rodilla_I[0] = 0.18 + 0.2 * Math.max(0, -patada);
      o.rodilla_D[0] = 0.18 + 0.2 * Math.max(0, patada);
      o.torso[1] = 0.28 * Math.cos(brazada) * f;
      o.cabeza[0] = -0.85;                     // levanta la cara para mirar al frente
      o.cabeza[1] = -0.28 * Math.cos(brazada) * f;
      // cuerpo entero (lo aplica Humano en #inclinarCuerpo): se balancea con la brazada en el mismo
      // sentido que el giro del torso, sube y baja con cada brazada, y va mas vertical (las piernas
      // se hunden) cuando casi no avanza, como alguien que se mantiene a flote
      ctx.roll = 0.16 * Math.cos(brazada) * f;
      ctx.cabeceo = -0.16 * (1 - vf) + 0.035 * Math.sin(brazada * 2) * vf;
      ctx.bob = Math.sin(brazada * 2) * 0.04 * (0.4 + 0.6 * vf);
    },

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

    // Braza lenta en el mar (propia del mar, distinta de la del oasis): brazada larga con deslizamiento,
    // cuerpo tendido y medio hundido, patada de rana potente.
    poseNadoBraza(ctx) {
      const { velocidad, dt, o } = ctx;
      const f = 0.5 + 0.5 * Math.min(velocidad / 1.9, 1);
      this.faseBraza = avanzarFase(this.faseBraza, dt, 2.3 + 0.5 * f);
      const p = this.faseBraza;
      const abre = Math.max(0, Math.sin(p)), recoge = Math.max(0, -Math.sin(p));
      for (const [nom, fuera, codo] of [["I", 1, -1], ["D", -1, 1]]) {
        o["hombro_" + nom][0] = (-2.8 + 0.9 * abre + 1.4 * recoge) * f - 0.2 * (1 - f);
        o["hombro_" + nom][2] = fuera * (0.1 + 1.1 * abre) * f;
        o["codo_" + nom][1] = codo * (0.1 + 0.4 * abre + 1.7 * recoge) * f;
      }
      const patada = Math.max(0, Math.sin(p + 0.9)) * f;
      for (const [nom, fuera] of [["I", -1], ["D", 1]]) {
        o["muslo_" + nom][0] = 0.12 + 0.25 * patada;
        o["muslo_" + nom][2] = fuera * (0.08 + 0.5 * patada);
        o["rodilla_" + nom][0] = 0.2 + 0.9 * patada;
      }
      o.torso[0] = -0.06;
      o.cabeza[0] = -0.8;
      ctx.roll = 0.05 * Math.sin(p) * f;
      ctx.cabeceo = -0.12 + 0.05 * abre;
      ctx.bob = -0.06 + 0.04 * Math.sin(p);
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

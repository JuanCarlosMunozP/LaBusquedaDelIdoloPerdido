// Nado del OASIS (estanque calmado): braza tranquila y chapoteo "de perrito" al arrancar. Van mas
// incorporadas que en el mar y con el cuerpo medio hundido. Las del mar viven en posesNadoMar.js.
import { avanzarFase } from './mezcla.js';

export function crearPosesNadoOasis() {
  return {
    // Braza en el estanque del oasis.
    poseNadoOasis(ctx) {
      const { velocidad, dt, o } = ctx;
      // braza en el estanque: tranquila y con la cabeza fuera. Los brazos se estiran al frente, se
      // abren en arco, se recogen bajo el pecho y vuelven a salir; las piernas se encogen y patean
      // como rana. En el sitio solo chapotea suave.
      const f = 0.4 + 0.6 * Math.min(velocidad / 1.9, 1);
      // fase acumulada (en ciclos): si dependiera de `tiempo * frecuencia`, cada cambio de velocidad
      // haria saltar los brazos a otra posicion de la brazada
      this.faseOasis = avanzarFase(this.faseOasis, dt, (1.1 + 0.6 * Math.min(velocidad / 1.9, 1)) * Math.PI * 2) / (Math.PI * 2);
      const p = this.faseOasis;
      const abre = Math.max(0, Math.sin(Math.PI * 2 * p));      // brazos abiertos en arco
      const recoge = Math.max(0, -Math.sin(Math.PI * 2 * p));   // codos recogidos bajo el pecho
      for (const [nom, fuera, codo] of [["I", 1, -1], ["D", -1, 1]]) {   // fuera = signo que aleja el brazo del cuerpo
        o["hombro_" + nom][0] = (-2.85 + 0.75 * abre + 1.35 * recoge) * f - 0.25 * (1 - f);   // con el cuerpo tendido, -2.85 = brazo estirado por delante de la cabeza
        o["hombro_" + nom][2] = fuera * (0.1 + 1.05 * abre) * f;
        o["codo_" + nom][1] = codo * (0.1 + 0.5 * abre + 1.6 * recoge) * f;
      }
      const encoge = Math.max(0, Math.sin(Math.PI * 2 * (p + 0.15))) * f;    // las piernas se encogen y luego patean
      for (const [nom, fuera] of [["I", -1], ["D", 1]]) {
        o["muslo_" + nom][0] = 0.1 + 0.2 * encoge;
        o["muslo_" + nom][2] = fuera * (0.08 + 0.45 * encoge);
        o["rodilla_" + nom][0] = 0.15 + 0.7 * encoge;   // patada de rana bien marcada
      }
      o.torso[0] = -0.08;
      o.cabeza[0] = -0.7;                       // mira al frente, fuera del agua
      ctx.roll = 0.04 * Math.sin(Math.PI * 2 * p) * f;   // leve balanceo de lado a lado con cada braceo
      ctx.cabeceo = -0.04 * (1 - f);                      // casi vertical cuando se queda en el sitio
      ctx.bob = Math.sin(Math.PI * 2 * p) * 0.025;
    },

    // Nado "de perrito" (oasis, al arrancar): brazos que chapotean alternados delante del pecho,
    // cabeza bien alta y patada de bicicleta rapida con el cuerpo medio incorporado.
    poseNadoPerro(ctx) {
      const { dt, o, tiempo, velocidad } = ctx;
      this.fasePerro = avanzarFase(this.fasePerro, dt, 6.5);
      const ph = this.fasePerro, vf = 0.5 + 0.5 * Math.min(velocidad / 1.2, 1);
      for (const [nom, fuera, desfase] of [["I", 1, 0], ["D", -1, Math.PI]]) {
        const q = ph + desfase, s = Math.sin(q);
        o["hombro_" + nom][0] = -1.9 + 0.7 * s * vf;       // el brazo sube y baja delante
        o["hombro_" + nom][2] = fuera * (0.25 + 0.15 * Math.cos(q));
        o["codo_" + nom][1] = -fuera * (0.5 + 0.7 * Math.max(0, -s));
      }
      for (const [nom, desfase] of [["I", 0], ["D", Math.PI]]) {
        const q = tiempo * 10 + desfase;
        o["muslo_" + nom][0] = 0.1 + 0.4 * Math.sin(q);
        o["rodilla_" + nom][0] = 0.3 + 0.35 * Math.max(0, Math.cos(q));
      }
      o.torso[0] = -0.1;
      o.cabeza[0] = -0.75;
      ctx.roll = 0.06 * Math.sin(ph);
      ctx.cabeceo = -0.32;                                  // medio incorporado
      ctx.bob = 0.03 * Math.sin(ph * 2);
    },
  };
}

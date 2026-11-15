// Nado de costado, comun al mar y al oasis (cada agua tiene sus propias poses en posesNadoMar.js y
// posesNadoOasis.js). Usa el mismo cuadro `ctx` que el resto de poses. Convencion de los brazos: con el
// cuerpo tendido, hombro[0] negativo lleva el brazo por delante de la cabeza; hombro[2] positivo en "I"
// y negativo en "D" lo abre. Las fases son acumuladas (avanzarFase): cambiar de velocidad no hace
// saltar los brazos.
import { avanzarFase } from './mezcla.js';

export function crearPosesNado() {
  return {
    // Remar sentado en el bote: piernas al frente, el torso se inclina y los brazos tiran de los remos.
    // `faseBote` es la fase de remada del bote (juego/bote.js), asi brazos y remos van sincronizados.
    poseRemar(ctx) {
      const { o } = ctx;
      const ph = this.faseBote || 0, f = Math.min(this.remando, 1);
      const tira = Math.cos(ph) * f;                      // 1 = brazos adelante, -1 = remo pegado al pecho
      o.muslo_I[0] = o.muslo_D[0] = -1.35;                // sentado: muslos al frente
      o.muslo_I[2] = -0.12; o.muslo_D[2] = 0.12;
      o.rodilla_I[0] = o.rodilla_D[0] = 1.25 - 0.25 * tira * f;
      for (const [nom, s] of [["I", -1], ["D", 1]]) {
        o["hombro_" + nom][0] = -0.95 - 0.7 * tira;
        o["hombro_" + nom][2] = -s * 0.18;
        o["codo_" + nom][1] = s * -(0.25 + 0.95 * (1 - tira) * 0.5 + 0.2);
      }
      o.torso[0] = 0.12 + 0.3 * tira;                     // se echa adelante al estirar y atras al tirar
      o.cadera[0] = 0; o.cadera[1] = 0; o.cadera[2] = 0;
      o.torso[1] = 0; o.torso[2] = 0;
      o.cabeza[0] = -0.15; o.cabeza[1] = 0; o.cabeza[2] = 0;
      ctx.bob = 0;
    },

    // Nado de costado: el cuerpo gira sobre un flanco, el brazo de abajo tira y el de arriba
    // vuelve por el aire, con patada de tijera.
    poseNadoLado(ctx) {
      const { dt, o, tiempo, velocidad } = ctx;
      this.faseLado = avanzarFase(this.faseLado, dt, 3.4);
      const ph = this.faseLado, vf = 0.5 + 0.5 * Math.min(velocidad / 2, 1);
      const tira = Math.sin(ph), recobro = Math.max(0, -tira);
      o.hombro_I[0] = -2.5 + 1.4 * tira * vf;               // brazo inferior: estira y tira hacia atras
      o.hombro_I[2] = 0.2;
      o.codo_I[1] = 0.15 + 0.5 * Math.max(0, tira);
      o.hombro_D[0] = -1.2 - 1.3 * tira * vf;               // brazo superior: recobra por el aire
      o.hombro_D[2] = -(0.3 + 0.55 * recobro);
      o.codo_D[1] = -(0.2 + 1.2 * recobro);
      const tijera = Math.sin(ph * 2);
      o.muslo_I[0] = 0.1 + 0.4 * tijera;
      o.muslo_D[0] = 0.1 - 0.4 * tijera;
      o.rodilla_I[0] = 0.2 + 0.3 * Math.max(0, -tijera);
      o.rodilla_D[0] = 0.2 + 0.3 * Math.max(0, tijera);
      o.torso[1] = 0.3;
      o.cabeza[0] = -0.7;
      o.cabeza[1] = 0.35;
      ctx.roll = 1.0;                                       // rodado sobre el costado
      ctx.cabeceo = 0.02;
      ctx.bob = 0.02 * Math.sin(ph * 2);
    },

  };
}

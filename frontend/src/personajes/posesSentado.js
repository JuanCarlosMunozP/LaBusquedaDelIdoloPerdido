// Max sentado en el sillon de la escena final, frente a la fogata. No es una pose fija: cada unos segundos
// pasa de "calentarse las manos" (inclinado hacia el fuego, manos abiertas que se frotan despacio) a
// "descansar" (recostado, brazos sueltos sobre las piernas), y de vez en cuando mira el fuego, la
// habitacion o baja la cabeza. Convencion de brazos como en poseRecargar: hombro[0] negativo = al frente,
// codo[1] positivo flexiona el derecho y negativo el izquierdo.
import { suave } from './ayudas.js';

export function crearPosesSentado() {
  return {
    poseSentado(ctx) {
      const { o, tiempo: t } = ctx;
      // 0 = descansa recostado, 1 = se calienta las manos; cambia despacio (unos 9 s por vuelta)
      const calienta = suave(-0.35, 0.35, Math.sin(t * 0.7 + 0.8) * 0.6 + Math.sin(t * 0.29) * 0.4);

      o.muslo_I[0] = o.muslo_D[0] = -1.47;                 // sentado: muslos al frente
      o.muslo_I[2] = -0.1; o.muslo_D[2] = 0.1;             // rodillas un poco abiertas
      o.rodilla_I[0] = 1.5 - 0.06 * calienta;
      o.rodilla_D[0] = 1.5 - 0.06 * calienta;
      o.cadera[0] = 0; o.cadera[1] = 0; o.cadera[2] = 0;

      const respira = Math.sin(t * 1.5) * 0.012;
      o.torso[0] = -0.06 * (1 - calienta) + 0.2 * calienta + respira;   // recostado o inclinado hacia el fuego
      o.torso[1] = 0.05 * Math.sin(t * 0.37);
      o.torso[2] = 0;

      // manos: abiertas hacia el fuego y frotandose, o apoyadas sueltas en los muslos
      const frota = Math.sin(t * 5.2) * 0.07 * calienta;
      const hombro0 = -0.3 * (1 - calienta) + -1.05 * calienta;
      o.hombro_I[0] = hombro0 + frota;
      o.hombro_D[0] = hombro0 - frota;
      o.hombro_I[2] = 0.22 * (1 - calienta) + 0.12 * calienta;
      o.hombro_D[2] = -(0.22 * (1 - calienta) + 0.12 * calienta);
      o.codo_I[1] = -(0.55 * (1 - calienta) + 0.95 * calienta);
      o.codo_D[1] = 0.55 * (1 - calienta) + 0.95 * calienta;
      o.hombro_I[1] = 0.1 * calienta; o.hombro_D[1] = -0.1 * calienta;

      // cabeza: mira al fuego (un poco hacia abajo), a veces a la habitacion
      const mira = Math.max(0, Math.sin(t * 0.21 + 1.3));
      o.cabeza[0] = 0.12 + 0.1 * Math.sin(t * 0.5) - 0.1 * calienta;
      o.cabeza[1] = 0.5 * mira * Math.sin(t * 0.9) + 0.06 * Math.sin(t * 2.1);
      o.cabeza[2] = 0.04 * Math.sin(t * 0.43);
      ctx.bob = 0;
    }
  };
}

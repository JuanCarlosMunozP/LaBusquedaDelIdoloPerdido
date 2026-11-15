// Estilos de andar de Humano: una capa que se suma a poseCaminar (poses.js) para que no todos
// caminen y corran igual. Cada estilo ajusta la pose ya mezclada con un peso (el de "caminar"), asi
// entrar y salir del estilo es suave. Los usa el jugador (segun lo que hace) y cada mercenario
// (uno al azar, para que no marchen al unisono).
//   swing: multiplica el vaiven de los brazos     codo: grados extra de codo (rad)
//   torso/cabeza: inclinacion extra (rad, + = adelante/abajo)   rodilla: multiplica el alzado de rodilla
//   cadera: multiplica el giro de caderas   balanceo: inclinacion lateral de caderas   bob: multiplica el rebote
export const ESTILOS_ANDAR = {
  normal: { swing: 1, codo: 0, torso: 0, cabeza: 0, rodilla: 1, cadera: 1, balanceo: 0.03, bob: 1 },
  relajado: { swing: 1.3, codo: -0.08, torso: -0.04, cabeza: -0.05, rodilla: 0.9, cadera: 1.5, balanceo: 0.07, bob: 1.1 },
  marcial: { swing: 0.55, codo: 0.55, torso: -0.1, cabeza: -0.06, rodilla: 1.25, cadera: 0.6, balanceo: 0.02, bob: 0.8 },
  agil: { swing: 1.15, codo: 0.2, torso: 0.1, cabeza: -0.05, rodilla: 1.5, cadera: 1.1, balanceo: 0.04, bob: 1.5 },
  cansado: { swing: 0.45, codo: 0.1, torso: 0.28, cabeza: 0.3, rodilla: 0.65, cadera: 0.8, balanceo: 0.08, bob: 0.7 },
  sigiloso: { swing: 0.5, codo: 0.4, torso: 0.3, cabeza: -0.1, rodilla: 1.2, cadera: 0.9, balanceo: 0.03, bob: 0.4 }
};
export const NOMBRES_ESTILO_ANDAR = Object.keys(ESTILOS_ANDAR);

export function crearPosesAndar() {
  return {
    // Capa de estilo: se aplica solo mientras pesa el estado "caminar".
    poseEstiloAndar(ctx) {
      const w = this.pesosBase?.caminar ?? 0;
      const e = ESTILOS_ANDAR[this.estiloAndar];
      if (!e || w < 0.01) return;
      const { o, c, A } = ctx;
      const k = (v) => 1 + (v - 1) * w;
      o.hombro_I[0] *= k(e.swing); o.hombro_D[0] *= k(e.swing);
      o.codo_I[1] -= e.codo * w; o.codo_D[1] += e.codo * w;
      o.torso[0] += e.torso * w;
      o.cabeza[0] += e.cabeza * w;
      o.rodilla_I[0] *= k(e.rodilla); o.rodilla_D[0] *= k(e.rodilla);
      o.cadera[1] *= k(e.cadera);
      o.cadera[2] += e.balanceo * c * Math.min(A, 1.2) * w;     // la cadera cae hacia el lado de la pierna que se apoya
      o.torso[2] -= 0.5 * e.balanceo * c * Math.min(A, 1.2) * w; // y el torso compensa
      ctx.bob *= k(e.bob);
    }
  };
}

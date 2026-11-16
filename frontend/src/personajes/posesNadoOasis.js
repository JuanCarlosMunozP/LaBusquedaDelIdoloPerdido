// Nado del OASIS (estanque calmado): braza tranquila y chapoteo "de perrito" al arrancar. Van mas
// incorporadas que en el mar y con el cuerpo medio hundido. Las del mar viven en posesNadoMar.js.
import { avanzarFase } from './mezcla.js';

// Numero pseudoaleatorio estable en [0, 1) a partir de un valor (sin Math.random: mismo resultado en cada prueba).
const azar = (n) => { const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return x - Math.floor(x); };

// Gestos de flotar en el sitio: sc = cuanto rema con las manos, ab = apertura de brazos, pd = pedaleo de piernas,
// cab = inclinacion del cuerpo (mas negativo = mas vertical), mira = giro de cabeza, bajo = cuanto se hunde.
const VARIANTES_FLOTAR = [
  { sc: 1.0, ab: 0.85, pd: 1.0, cab: -1.05, mira: 0.2, bajo: -1.0 },     // pedalea con fuerza
  { sc: 0.55, ab: 0.65, pd: 0.35, cab: -0.95, mira: 0.35, bajo: -0.92 }, // remo suave con las manos, casi sin patear
  { sc: 0.3, ab: 1.15, pd: 0.2, cab: -0.8, mira: 0.55, bajo: -0.85 }     // descansa con los brazos abiertos y mira alrededor
];

export function crearPosesNadoOasis() {
  return {
    // Braza en el estanque del oasis.
    poseNadoOasis(ctx) {
      const { velocidad, dt, o } = ctx;
      // braza en el estanque: tranquila y con la cabeza fuera. Los brazos se estiran al frente, se
      // abren en arco, se recogen bajo el pecho y vuelven a salir; las piernas se encogen y patean
      // como rana. En el sitio solo chapotea suave.
      const vf = Math.min(velocidad / 1.9, 1);
      // fase acumulada (en ciclos): si dependiera de `tiempo * frecuencia`, cada cambio de velocidad
      // haria saltar los brazos a otra posicion de la brazada
      // (la fase se guarda en radianes; antes se dividia entre 2π en cada cuadro y la brazada se quedaba casi quieta)
      const antes = this.faseOasis || 0;
      this.faseOasis = avanzarFase(antes, dt, (1.1 + 0.6 * vf) * Math.PI * 2);
      const ciclo = this.faseOasis / (Math.PI * 2);        // 0..1 dentro de la brazada
      if (this.faseOasis < antes) {                       // empieza una brazada nueva: cada una sale distinta
        this.brazadaOasis = (this.brazadaOasis || 0) + 1;
        const r = azar(this.brazadaOasis);
        this.fuerzaBrazada = 0.8 + 0.35 * r;              // brazada mas corta o mas amplia
        this.planeoBrazada = 0.08 + 0.3 * azar(this.brazadaOasis + 7);   // cuanto se desliza estirado antes de la siguiente
      }
      const planeo = this.planeoBrazada ?? 0.2;
      // la fuerza y el planeo cambian con suavidad al empezar otra brazada (sin saltos de un cuadro a otro)
      const ks = 1 - Math.exp(-8 * dt);
      this.fuerzaSuave = (this.fuerzaSuave ?? 1) + ((this.fuerzaBrazada ?? 1) - (this.fuerzaSuave ?? 1)) * ks;
      const f = (0.4 + 0.6 * vf) * this.fuerzaSuave;
      // la brazada ocupa el principio del ciclo y el resto es planeo: brazos al frente y piernas juntas
      const p = ciclo < 1 - planeo ? ciclo / (1 - planeo) : 1;
      this.planeaSuave = (this.planeaSuave ?? 0) + ((ciclo > 1 - planeo ? 1 : 0) - (this.planeaSuave ?? 0)) * (1 - Math.exp(-10 * dt));
      const planea = this.planeaSuave;
      const abre = Math.max(0, Math.sin(Math.PI * 2 * p));      // brazos abiertos en arco
      const recoge = Math.max(0, -Math.sin(Math.PI * 2 * p));   // codos recogidos bajo el pecho
      for (const [nom, fuera, codo] of [["I", 1, -1], ["D", -1, 1]]) {   // fuera = signo que aleja el brazo del cuerpo
        o["hombro_" + nom][0] = (-2.85 + 0.75 * abre + 1.35 * recoge) * f - 0.25 * (1 - f);   // con el cuerpo tendido, -2.85 = brazo estirado por delante de la cabeza
        o["hombro_" + nom][2] = fuera * (0.1 + 1.05 * abre) * f;
        o["codo_" + nom][1] = codo * (0.1 + 0.5 * abre + 1.6 * recoge) * f;
      }
      const encoge = Math.max(0, Math.sin(Math.PI * 2 * (p + 0.15))) * f * (1 - planea);    // las piernas se encogen, patean y se juntan al planear
      for (const [nom, fuera] of [["I", -1], ["D", 1]]) {
        o["muslo_" + nom][0] = 0.1 + 0.2 * encoge;
        o["muslo_" + nom][2] = fuera * (0.08 + 0.45 * encoge);
        o["rodilla_" + nom][0] = 0.15 + 0.7 * encoge;   // patada de rana bien marcada
      }
      const t = ctx.tiempo || 0;
      o.torso[0] = -0.08 + 0.05 * recoge * f;             // se alza un poco al recoger los brazos
      o.torso[1] = 0.07 * Math.sin(Math.PI * 2 * p) * f;  // los hombros acompañan cada brazada
      o.cabeza[0] = -0.7 + 0.12 * recoge;                 // mira al frente, fuera del agua
      o.cabeza[1] = 0.28 * Math.sin(t * 0.55) * Math.max(0, Math.sin(t * 0.23)) - o.torso[1];   // de vez en cuando mira alrededor
      ctx.roll = 0.04 * Math.sin(Math.PI * 2 * p) * f;   // leve balanceo de lado a lado con cada braceo
      ctx.cabeceo = -0.04 * (1 - f) - 0.05 * recoge;      // casi vertical cuando se queda en el sitio
      ctx.bob = Math.sin(Math.PI * 2 * p) * 0.025 * (1 - planea) - 0.012 * planea;
    },

    // Mantenerse a flote en el estanque: no es un solo gesto; cada pocos segundos cambia entre pedalear,
    // remar suave con las manos o descansar mirando alrededor. Los parametros se acercan despacio al
    // nuevo gesto, asi que no hay saltos. (Se usa en lugar de poseFlotar cuando el agua es el oasis.)
    poseFlotarOasis(ctx) {
      const { dt, o, tiempo } = ctx;
      const e = this.flotarOasis || (this.flotarOasis = { v: 0, hasta: 0, sc: 1, ab: 0.85, pd: 1, cab: -1.05, mira: 0.2, bajo: -1 });
      if (tiempo >= e.hasta) {                            // elige el siguiente gesto
        e.v = (e.v + 1 + Math.floor(azar(tiempo) * 2)) % VARIANTES_FLOTAR.length;
        e.hasta = tiempo + 3.5 + azar(tiempo + 3) * 3.5;
      }
      const meta = VARIANTES_FLOTAR[e.v], k = 1 - Math.exp(-1.6 * dt);
      for (const c of Object.keys(meta)) e[c] += (meta[c] - e[c]) * k;
      this.faseFlotar = avanzarFase(this.faseFlotar, dt, 1.6 + 1.1 * e.sc);
      const ph = this.faseFlotar;
      for (const [nom, fuera, desfase] of [["I", 1, 0], ["D", -1, Math.PI * 0.7]]) {   // las manos no van a la par
        const q = ph + desfase;
        o["hombro_" + nom][0] = -0.55 - 0.15 * e.ab + 0.4 * e.sc * Math.sin(q);
        o["hombro_" + nom][2] = fuera * (e.ab + 0.22 * e.sc * Math.cos(q));
        o["codo_" + nom][1] = -fuera * (0.55 + 0.4 * e.sc * Math.sin(q + 1));
      }
      for (const [nom, fuera, desfase] of [["I", -1, 0], ["D", 1, Math.PI * 0.85]]) {
        const q = ph * 0.9 + desfase;
        o["muslo_" + nom][0] = -0.3 + 0.45 * e.pd * Math.sin(q);
        o["muslo_" + nom][2] = fuera * (0.1 + 0.06 * (1 - e.pd));
        o["rodilla_" + nom][0] = 0.6 + 0.25 * (1 - e.pd) + 0.55 * e.pd * Math.max(0, Math.cos(q));
      }
      o.torso[0] = -0.08;
      o.torso[1] = 0.08 * Math.sin(ph * 0.5);
      o.cabeza[0] = -0.35;
      o.cabeza[1] = e.mira * Math.sin(tiempo * 0.7);
      ctx.cabeceo = e.cab;
      ctx.bob = e.bajo + 0.045 * Math.sin(ph * 2 + tiempo * 0.3) + 0.02 * Math.sin(tiempo * 1.3);
      ctx.roll = 0.04 * Math.sin(ph * 0.5);
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

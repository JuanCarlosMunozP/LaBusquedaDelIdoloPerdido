// Poses de Humano: cada metodo calcula las rotaciones objetivo de las articulaciones para un
// tipo de movimiento (caminar, nadar, golpear, morir...). Se agregan a `Humano` (ver el final de
// personaje.js), asi que usan `this`. Todos reciben el mismo cuadro `ctx` que arma
// Humano.actualizar: `ctx.o` son las rotaciones objetivo [x, y, z] por articulacion y `ctx.bob`
// es el rebote vertical del cuerpo.
import * as THREE from 'three';
import { suave } from './ayudas.js';
import { ARTICULACIONES, DURACION_GOLPE } from './constantes.js';
import { avanzarFase } from './mezcla.js';
import { crearPosesNado } from './posesNado.js';
import { crearPosesNadoMar } from './posesNadoMar.js';
import { crearPosesNadoOasis } from './posesNadoOasis.js';
import { crearPosesSentado } from './posesSentado.js';
import { crearPosesCombate } from './posesCombate.js';
import { crearPosesAndar } from './posesAndar.js';
import { crearPosesRecarga } from './posesRecarga.js';

// Variantes del reposo (duracion en segundos)
const VARIANTES_REPOSO = [
  { tipo: "peso", dur: 3.2 },
  { tipo: "mirar", dur: 3.6 },
  { tipo: "respiro", dur: 2.4 },
  { tipo: "curioso", dur: 2.6 }
];

export const posesHumano = {
  // Salto o caida: piernas y brazos sueltos en el aire.
  poseAire(ctx) {
    const { tiempo, velocidadVertical, o } = ctx;
    const subida = THREE.MathUtils.clamp(velocidadVertical / 7.2, 0, 1);
    const bajada = THREE.MathUtils.clamp(-velocidadVertical / 7.2, 0, 1);
    const cima = 1 - Math.max(subida, bajada);
    const pedaleo = Math.sin(tiempo * 9);          // las piernas se alternan suavemente en el aire
    const balanceo = pedaleo * 0.3;
    o.muslo_I[0] = -0.38 - 0.18 * subida + 0.12 * bajada + balanceo;
    o.muslo_D[0] = 0.24 - 0.12 * subida + 0.16 * bajada - balanceo;
    o.rodilla_I[0] = 0.58 + 0.25 * cima + 0.12 * bajada + 0.3 * Math.max(0, pedaleo);
    o.rodilla_D[0] = 0.48 + 0.3 * cima + 0.12 * subida + 0.3 * Math.max(0, -pedaleo);
    // brazos: se adelantan un poco al impulsarse (sin abrirse a los lados), quedan
    // sueltos con el codo doblado en la cima y se abren apenas al caer para equilibrar
    const impulso = 0.55 * subida + 0.3 * cima + 0.12 * bajada;
    o.hombro_I[0] = -impulso;
    o.hombro_D[0] = -impulso * 0.9;
    o.hombro_I[2] = 0.1 + 0.16 * cima + 0.22 * bajada;
    o.hombro_D[2] = -(0.1 + 0.16 * cima + 0.22 * bajada);
    o.codo_I[1] = -(0.45 + 0.35 * subida + 0.15 * cima);
    o.codo_D[1] = 0.42 + 0.35 * subida + 0.15 * cima;
    o.torso[0] = -0.12 * subida + 0.15 * bajada;
    o.cabeza[0] = 0.06 * subida - 0.08 * bajada;
    ctx.bob = 0.025 * subida - 0.02 * bajada;
  },

  // Caminar y correr.
  poseCaminar(ctx) {
    const { o, A, s, c, corre } = ctx;
    // caminar / correr: zancada corta, piernas juntas
    const L = THREE.MathUtils.lerp;
    const paso = L(Math.min(A, 1.2) * 0.44, 0.82, corre);
    o.muslo_I[0] = s * paso;
    o.muslo_D[0] = -s * paso;
    o.rodilla_I[0] = Math.max(0, -c) * L(1.0 * Math.min(A, 1.2), 1.8, corre);
    o.rodilla_D[0] = Math.max(0, c) * L(1.0 * Math.min(A, 1.2), 1.8, corre);
    // brazos: balanceo hacia adelante y atras, opuesto a la pierna del mismo lado;
    // el codo se dobla mas cuando el brazo va hacia adelante
    const Ab = Math.min(A, 1.5);
    const vaiven = L(0.72 * Ab, 1.05, corre);
    o.hombro_I[0] = -s * vaiven;
    o.hombro_D[0] = s * vaiven;
    o.codo_I[1] = -L(0.22 + 0.2 * Ab + 0.5 * Ab * Math.max(0, s), 1.2 + 0.25 * s, corre);
    o.codo_D[1] = L(0.22 + 0.2 * Ab + 0.5 * Ab * Math.max(0, -s), 1.2 - 0.25 * s, corre);
    // los brazos se acercan al cuerpo al pasar hacia adelante (no se abren a los lados)
    o.hombro_I[2] = -0.1 * Math.max(0, s) * Ab;
    o.hombro_D[2] = 0.1 * Math.max(0, -s) * Ab;
    // caderas y hombros giran en sentido contrario, la cabeza se mantiene mirando al frente
    o.cadera[1] = s * 0.10 * A;
    o.cadera[2] = -s * 0.04 * Math.min(A, 1.2);
    o.cadera[0] = 0.04 * Math.abs(c) * Math.min(A, 1.2);   // la pelvis cabecea un poco con cada paso
    o.torso[1] = -s * 0.22 * A;
    o.torso[0] = 0.05 + 0.07 * A + 0.17 * corre;   // al correr se inclina hacia adelante
    o.cabeza[1] = s * 0.12 * A;
    o.cabeza[2] = 0.03 * c * Math.min(A, 1.2);              // la cabeza acompaña el balanceo del paso
    o.cabeza[0] = -0.12 * corre;
    // Inclinacion al girar y al arrancar/frenar (ejes: +Z = inclinarse a la derecha del personaje,
    // +X de torso = hacia adelante). giro > 0 = gira a su izquierda, asi que se inclina hacia ella
    // (negativo). Acelerar lo echa hacia adelante; frenar, hacia atras.
    const presencia = Math.min(A, 1);
    const ladeo = -THREE.MathUtils.clamp((ctx.giro || 0) * 0.04, -0.2, 0.2) * presencia * (0.6 + 0.4 * corre);
    o.torso[2] += ladeo;
    o.cabeza[2] -= 0.6 * ladeo;                  // la cabeza compensa y se mantiene casi nivelada
    o.cadera[2] -= 0.4 * ladeo;
    o.torso[0] += THREE.MathUtils.clamp((ctx.accel || 0) * 0.012, -0.12, 0.12) * presencia;
    ctx.bob = Math.abs(c) * (0.06 * A + 0.05 * corre);
  },

  // Quieto: respira, mira un poco a los lados y, de vez en cuando, hace algo distinto (cambia el
  // peso de pierna, mira alrededor, respira hondo, ladea la cabeza) para no verse congelado.
  poseReposo(ctx) {
    const { dt, tiempo, o } = ctx;
    // reposo: respira y mira un poco a los lados
    o.torso[0] = Math.sin(tiempo * 1.8) * 0.012;
    o.hombro_I[2] = -0.04 + Math.sin(tiempo * 1.8) * 0.01;
    o.hombro_D[2] = 0.04 - Math.sin(tiempo * 1.8) * 0.01;
    o.codo_I[1] = -0.18;
    o.codo_D[1] = 0.18;
    o.cabeza[1] = Math.sin(tiempo * 0.5) * 0.18;

    // variante ocasional: espera unos segundos quieto, la hace de principio a fin y vuelve a esperar
    const azar = this.azar || Math.random;
    const v = this.varianteReposo || (this.varianteReposo = { tipo: null, t: 0, dur: 0, lado: 1, espera: 2 + azar() * 4, ultimo: null });
    if (v.tipo === null) {
      v.espera -= dt;
      if (v.espera <= 0) {
        const tipos = VARIANTES_REPOSO.filter((x) => x.tipo !== v.ultimo);   // no repite la misma dos veces seguidas
        const elegida = tipos[Math.min(tipos.length - 1, Math.floor(azar() * tipos.length))];
        v.tipo = elegida.tipo; v.dur = elegida.dur; v.t = 0; v.ultimo = elegida.tipo;
        v.lado = azar() < 0.5 ? -1 : 1;
      }
    } else {
      v.t += dt;
      if (v.t >= v.dur) { v.tipo = null; v.espera = 4 + azar() * 6; }
    }
    if (v.tipo !== null) {
      const x = Math.min(v.t / v.dur, 1);
      const s = Math.sin(Math.PI * x);
      const w = s * s;                                  // entra y sale con pendiente cero, sin tirones
      const lado = v.lado;
      if (v.tipo === "peso") {
        // se apoya en una pierna: el torso se carga sobre ella (+Z = derecha) y la otra se relaja
        const libre = lado > 0 ? "I" : "D";
        o.torso[2] += lado * 0.07 * w;
        o.cadera[2] += -lado * 0.05 * w;
        o.cabeza[2] += -lado * 0.04 * w;
        o["muslo_" + libre][0] += -0.12 * w;
        o["rodilla_" + libre][0] += 0.3 * w;
      } else if (v.tipo === "mirar") {
        // mira a un lado, luego al otro, girando un poco el torso
        const barrido = Math.sin(2 * Math.PI * x) * w;
        o.cabeza[1] += lado * 0.7 * barrido;
        o.torso[1] += lado * 0.22 * barrido;
      } else if (v.tipo === "respiro") {
        // respira hondo: pecho y cabeza se abren y los brazos se separan un poco del cuerpo
        o.torso[0] += -0.06 * w;
        o.cabeza[0] += -0.05 * w;
        o.hombro_I[2] += 0.07 * w;
        o.hombro_D[2] += -0.07 * w;
      } else if (v.tipo === "curioso") {
        // ladea la cabeza, como si algo le llamara la atencion
        o.cabeza[2] += lado * 0.2 * w;
        o.cabeza[0] += -0.05 * w;
        o.torso[2] += lado * 0.02 * w;
      }
    }
  },

  // Amortigua el impacto al tocar el suelo.
  ajusteAterrizaje(ctx) {
    const { dt, o } = ctx;
    // la fuerza depende de la caida (un salto normal vale 1; desde mas alto, hasta 1.6)
    const intensidad = (this.impactoAterrizaje / 0.18) * (this.fuerzaAterrizaje ?? 1);
    this.impactoAterrizaje = Math.max(0, this.impactoAterrizaje - dt);
    o.muslo_I[0] -= 0.12 * intensidad;
    o.muslo_D[0] -= 0.12 * intensidad;
    o.rodilla_I[0] += 0.72 * intensidad;
    o.rodilla_D[0] += 0.72 * intensidad;
    o.torso[0] += 0.12 * intensidad;
    ctx.bob -= 0.055 * intensidad;
  },

  // Apuntar con el arma: el brazo derecho se estira al frente.
  poseApuntar(ctx) {
    const { o } = ctx;
    const ap = this.apuntando || 0;
    const L = THREE.MathUtils.lerp;
    o.hombro_D[0] = L(o.hombro_D[0], -1.5, ap);
    o.hombro_D[2] = L(o.hombro_D[2], -0.04, ap);
    o.codo_D[1] = L(o.codo_D[1], 0.12, ap);
    o.torso[1] = L(o.torso[1], 0.18, ap);
    o.cabeza[1] = L(o.cabeza[1], -0.12, ap);
  },

  // Golpe de puno recto con un solo brazo.
  poseGolpe(ctx) {
    const { dt, o, punoObj } = ctx;
    if (this.congelarGolpe === undefined) this.golpeT += dt / DURACION_GOLPE;   // congelarGolpe: solo para el visor
    else this.golpeT = this.congelarGolpe;
    const p = Math.min(this.golpeT, 1);
    const der = this.brazoGolpe === "D";
    const at = der ? "D" : "I", gu = der ? "I" : "D";
    const lado = der ? 1 : -1;
    const mezcla = (a, b, t) => a + (b - a) * t;

    // levantar = cuanto sube el brazo desde reposo hasta la guardia (puño junto a la cara);
    // e = cuanto esta estirado. Solo se mueve el brazo que golpea: el otro sigue su pose
    // normal y le tocara cuando golpee el siguiente (se alternan).
    let e = 0, levantar;
    if (p < 0.25) {
      levantar = suave(0, 0.25, p);
    } else if (p < 0.45) {
      levantar = 1;
      e = suave(0.25, 0.45, p);
    } else if (p < 0.58) {
      levantar = 1;
      e = 1;
    } else if (p < 0.8) {
      levantar = 1;
      e = 1 - suave(0.58, 0.8, p);
    } else {
      levantar = 1 - suave(0.8, 1, p);
    }
    const prep = levantar * (1 - e);

    const GUARDIA_H = -0.62, GUARDIA_C = -2.05;
    // el brazo se echa un poco atras antes de salir disparado, y sale rapido y frena suave
    const retro = suave(0.1, 0.25, p) * (1 - e);
    const eRapido = 1 - (1 - e) * (1 - e);
    o["hombro_" + at][0] = mezcla(mezcla(o["hombro_" + at][0], GUARDIA_H + 0.3 * retro, levantar), -1.52, eRapido);
    o["hombro_" + at][2] += lado * 0.12 * levantar * (1 - e);
    o["codo_" + at][1] = lado * mezcla(-GUARDIA_C * levantar, 0.12, eRapido);
    // el otro brazo cuelga flojo con el codo doblado y se echa atras para equilibrar
    o["hombro_" + gu][0] += 0.3 * e;
    o["codo_" + gu][1] = -lado * (0.4 + 0.3 * levantar);
    // el puño se cierra al levantar el brazo y se abre otra vez al bajarlo
    punoObj[at] = 0.3 + 0.7 * suave(0, 0.2, p) * (1 - suave(0.85, 1, p));
    o.torso[1] = lado * mezcla(-0.25 * prep, 0.5, e);
    // la fuerza sale de las caderas: giran antes y menos que el torso, y asi el golpe "viene de abajo"
    o.cadera[1] = lado * mezcla(-0.12 * prep, 0.26, e);
    o.torso[0] = 0.08 + 0.2 * e;
    o.cabeza[1] = -lado * 0.35 * e;
    // postura de pelea: da un paso hacia adelante con la pierna contraria
    const adel = der ? "I" : "D", atras = der ? "D" : "I";
    o["muslo_" + adel][0] = -0.4 * Math.max(prep * 0.5, e);
    o["rodilla_" + adel][0] = 0.25 * e;
    o["muslo_" + atras][0] = 0.3 * Math.max(prep * 0.5, e);
    o["rodilla_" + atras][0] = 0.3 * e;
    ctx.bob = -0.06 * e;
    if (this.congelarGolpe === undefined && this.golpeT >= 1) this.golpeT = -1;
  },

  // Dano recibido: sacudida y destello rojo.
  poseDestello(ctx) {
    const { dt, o } = ctx;
    const dur = this.destelloDur || 0.2;
    this.destelloT -= dt;
    const k = Math.max(0, this.destelloT / dur);                  // el destello rojo baja en linea recta
    // el cuerpo reacciona con un ataque rapido (~0.04 s) y una salida suave: antes arrancaba en
    // su maximo en el primer cuadro y se veia como un tiron
    const trans = dur - Math.max(0, this.destelloT);
    const kc = suave(0, 0.04, trans) * (1 - suave(0.04, dur, trans));
    const e = this.destelloEmpuje;
    if (e) {
      // el golpe se siente segun por donde llega: de frente echa el pecho y la cabeza atras; por la
      // espalda lo dobla hacia adelante; de lado lo inclina (-Z = a su izquierda, +Z = a su derecha)
      const a = e.x * Math.sin(this.direccion) + e.z * Math.cos(this.direccion);       // >0 = lo empujan hacia adelante
      const l = e.x * Math.cos(this.direccion) - e.z * Math.sin(this.direccion);       // >0 = lo empujan hacia su izquierda
      o.torso[0] += kc * (0.12 + 0.2 * a);
      o.cabeza[0] = -0.3 * kc * (1 - 0.5 * a);
      o.torso[2] += -l * 0.16 * kc;
      o.cabeza[2] += l * 0.08 * kc;
      o.cadera[2] += l * 0.06 * kc;
      o.rodilla_I[0] += 0.18 * kc;
      o.rodilla_D[0] += 0.18 * kc;
    } else {
      o.torso[0] += 0.3 * kc;
      o.cabeza[0] = -0.35 * kc;
    }
    for (const m of this.mats) m.emissive.setRGB(0.9 * k, 0.05 * k, 0.05 * k);
  },

  // Herida: se agarra la zona golpeada.
  poseHerida(ctx) {
    const { dt, o, A, s } = ctx;
    const hd = this.herida;
    hd.t += dt;
    const w = suave(0, 0.3, hd.t) * (1 - suave(hd.dur - 0.7, hd.dur, hd.t));   // entra en ~0.3 s (antes 0.15: era un tiron)
    if (hd.t >= hd.dur) this.herida = null;
    const L = THREE.MathUtils.lerp;
    const pon = (n, i, v) => { o[n][i] = L(o[n][i], v, w); };
    const sg = { I: -1, D: 1 };                 // el codo se dobla hacia +/- segun el lado; igual el giro hacia el cuerpo
    const mano = (l, x, dentro, codo) => {      // lleva la mano del lado `l` hacia el cuerpo
      pon("hombro_" + l, 0, x);
      pon("hombro_" + l, 2, dentro * sg[l]);
      pon("codo_" + l, 1, codo * sg[l]);
    };
    const l = hd.lado, op = l === "D" ? "I" : "D";
    if (hd.parte === "abdomen") {
      mano("I", -0.95, 0.55, 1.7);
      mano("D", -0.95, 0.55, 1.7);
      pon("torso", 0, 0.5);
      pon("cabeza", 0, 0.25);
      pon("rodilla_I", 0, 0.2);
      pon("rodilla_D", 0, 0.2);
    } else if (hd.parte === "brazo") {
      mano(l, -0.25, 0.1, 0.6);                 // el brazo herido cuelga doblado
      mano(op, -0.9, 0.9, 1.6);                 // la otra mano lo agarra cruzando el pecho
      pon("torso", 0, 0.2);
      pon("cabeza", 0, 0.12);
    } else {
      mano(l, -0.75, 0.2, 0.9);                 // la mano baja a la pierna herida
      mano(op, -0.3, 0, 0.5);
      pon("torso", 0, 0.4);
      pon("cabeza", 0, 0.15);
      const mal = "muslo_" + l, malR = "rodilla_" + l;
      const rod = hd.parte === "rodilla" ? 0.2 : 0;
      if (A > 0.05) {                           // arrastra la pierna: queda atras y apenas se levanta
        pon(mal, 0, 0.15 + 0.15 * (l === "I" ? s : -s));
        pon(malR, 0, 0.25 + rod);
        pon("cadera", 2, 0.08 * sg[l]);
      } else {                                  // quieto: apoya solo la pierna sana
        pon(mal, 0, -0.12);
        pon(malR, 0, 0.55 + rod);
      }
    }
    // aguanta el dolor: respira agitado y le tiembla un poco el cuerpo (se desvanece junto con w)
    o.torso[0] += Math.sin(hd.t * 9) * 0.022 * w;
    o.cabeza[2] += Math.sin(hd.t * 5.5) * 0.03 * w;
  },

  // Modelos en T: baja los brazos sumando una rotacion base.
  poseBajarBrazos(ctx) {
    const { o } = ctx;
    o.hombro_I[2] -= this.bajarBrazos;
    o.hombro_D[2] += this.bajarBrazos;
  },

  // Inconsciente boca arriba.
  poseTendido(ctx) {
    const { tiempo, o } = ctx;
    for (const n of ARTICULACIONES) { const r = o[n]; r[0] = r[1] = r[2] = 0; }
    const resp = Math.sin(tiempo * 1.5);
    const baja = this.bajarBrazos || 0;
    o.torso[0] = 0.012 * resp;
    o.hombro_I[2] = 0.32 - baja;
    o.hombro_D[2] = -0.32 + baja;
    o.codo_I[1] = 0.12;
    o.codo_D[1] = -0.12;
    o.muslo_I[2] = -0.1;
    o.muslo_D[2] = 0.1;
    o.rodilla_I[0] = o.rodilla_D[0] = 0.05;
    o.cabeza[1] = 0.9;                      // la cara cae hacia un lado
    o.cabeza[2] = 0.15;
    ctx.bob = 0;
  },

  // Muerte: las rodillas ceden y el cuerpo se desploma.
  poseMuerte(ctx) {
    const { o } = ctx;
    const flexion = suave(0, 0.4, this.muerteT), suelta = suave(0.35, 1, this.muerteT);
    const lado = this.ladoCaida || 1;
    const alFrente = this.tipoCaida === "adelante", deEspaldas = this.tipoCaida === "atras";
    // Al terminar queda tendido y relajado: las rodillas dobladas del desplome se estiran (si no,
    // quedan en alto y parece suspendido), torso y cabeza se aplanan. De frente, la cabeza se
    // gira de lado para no apoyar la cara en el suelo; de lado, las piernas quedan semidobladas.
    const tipo = this.tipoCaida;
    const estira = tipo === "lado" ? 0.6 * suelta : suelta;
    o.muslo_I[0] = o.muslo_D[0] = -0.7 * flexion * (1 - estira);
    o.rodilla_I[0] = o.rodilla_D[0] = 1.3 * flexion * (1 - estira) + (tipo === "lado" ? 0.25 : 0.05) * suelta;
    o.cadera[0] = 0.3 * flexion * (1 - estira);
    o.torso[0] = alFrente ? 0.9 * flexion * (1 - suelta) : deEspaldas ? 0.55 * flexion * (1 - suelta) : 0.55 * flexion * (1 - suelta);
    o.torso[2] = 0;
    o.cabeza[0] = alFrente ? 0.3 * flexion * (1 - suelta) : 0.35 * flexion * (1 - suelta);
    o.cabeza[1] = alFrente ? -lado * 1.1 * suelta : 0;      // cara de lado contra el suelo
    o.cabeza[2] = tipo === "lado" ? (0.8) * lado * suelta : 0;
    // piernas un poco abiertas, como en una persona tendida
    o.muslo_I[2] = -0.06 * suelta; o.muslo_D[2] = 0.06 * suelta;
    // Brazos: mientras cae se agitan (cada uno con su retraso, asi no se mueven a la vez) y al llegar
    // al suelo se aflojan en una postura distinta cada vez (this.estiloMuerte: 0 abiertos, 1 una mano
    // en el pecho, 2 un brazo doblado junto a la cabeza). Siempre con el codo doblado: nada de brazos
    // estirados y tiesos. out = +1 en el brazo izquierdo, -1 en el derecho (hacia donde se abre).
    const anticipa = suave(0, 0.18, this.muerteT) * (1 - suave(0.82, 1, this.muerteT));
    const rebote = Math.sin(this.muerteT * Math.PI * 3.2) * anticipa;
    const direccion = alFrente ? 1 : deEspaldas ? -1 : lado * 0.45;
    const baja = this.bajarBrazos || 0;           // ajuste del modelo en T: sin el, los brazos quedan abiertos
    const estilo = this.estiloMuerte ?? 0;
    const protagonista = lado > 0 ? "D" : "I";    // el brazo que hace el gesto (pecho o cabeza)
    for (const nom of ["I", "D"]) {
      const out = nom === "I" ? 1 : -1;
      const retraso = Math.max(0, this.muerteT - (nom === "I" ? 0.08 : 0.14));
      const ola = Math.sin(retraso * Math.PI * 3.2) * anticipa;
      // en el aire: el cuerpo acompana el desequilibrio y el codo se dobla y estira un poco
      const v0 = -0.35 * flexion + direccion * 0.5 * ola;
      const vA = 0.08 - 0.19 * lado * out * rebote;
      const vC = 0.4 * flexion + 0.33 * Math.max(0, ola);
      // en el suelo
      let f0, fA, fC;
      const gesto = nom === protagonista;
      if (tipo === "lado") {
        // de lado, el brazo de abajo no puede quedar colgando (levantaria el cuerpo): va doblado
        // bajo la cabeza y el de arriba descansa sobre la cadera
        const abajo = lado < 0 ? "I" : "D";
        if (nom === abajo) { f0 = -0.9; fA = 0.25; fC = 1.5; }
        else { f0 = -0.5; fA = -0.35; fC = 1.1; }
      } else if (estilo === 1 && gesto) {            // se agarra la herida: la mano sobre el pecho o el abdomen
        f0 = alFrente ? 0.3 : -0.75; fA = alFrente ? 0.35 : -0.5; fC = alFrente ? 1.3 : 1.7;
      } else if (estilo === 2 && gesto) {            // un brazo doblado junto a la cabeza, como buscando apoyo
        f0 = alFrente ? -2.1 : -2.4; fA = 0.7; fC = 1.0;
      } else {                                        // abierto, flojo y algo doblado; cada lado distinto
        f0 = alFrente ? 0.25 : 0.12; fA = out === 1 ? 0.55 : 0.8; fC = alFrente ? 0.9 : 0.35 + 0.2 * (out === 1 ? 1 : 0);
      }
      o["hombro_" + nom][0] = v0 * (1 - suelta) + f0 * suelta;
      o["hombro_" + nom][2] = out * (vA * (1 - suelta) + fA * suelta - baja);
      o["codo_" + nom][1] = -out * (vC * (1 - suelta) + fC * suelta);
    }
    ctx.bob = 0;
  },
};

// estilos de nado extra (flotar, braza lenta, crol rapido, espalda): ver posesNado.js
Object.assign(posesHumano, crearPosesNado(), crearPosesNadoMar(), crearPosesNadoOasis(), crearPosesCombate(), crearPosesAndar(), crearPosesRecarga(), crearPosesSentado());

// En el estanque del oasis, "flotar" usa su propia version con gestos variados (posesNadoOasis.js)
const flotarDelMar = posesHumano.poseFlotar;
posesHumano.poseFlotar = function (ctx) {
  return (ctx.nadando === "oasis" ? posesHumano.poseFlotarOasis : flotarDelMar).call(this, ctx);
};

// Efectos puntuales del juego (agua, pasos, saltos, golpes, disparos, objetos). Todo se sintetiza con
// Web Audio, pero en capas, como se haria con grabaciones: un golpe grave (cuerpo), ruido filtrado
// (textura), transitorios agudos (ataque), burbujas con la frecuencia que sube (agua) y un poco de
// reverberacion (espacio). Se agregan a `Sonido` (ver el final de audio.js), asi que usan `this`.
//
// Todo se programa con el reloj de audio (no con setTimeout), para que los tiempos sean exactos.
// Ojo: exponentialRampToValueAtTime falla en el navegador con valores <= 0, por eso se usa PISO.
const PISO = 0.0001;
const azar = (a, b) => a + Math.random() * (b - a);

export const efectosSfx = {
  // Buffers y cadena de salida que necesitan los efectos: ruido rosa, reverberacion y compresor
  crearEfectos() {
    const ctx = this.ctx;

    // ruido rosa (mas natural que el blanco para agua, viento y pasos)
    const n = Math.floor(ctx.sampleRate * 3);
    this.ruidoRosa = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.ruidoRosa.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }

    // reverberacion: una respuesta de ruido que se apaga solo en ~1.3 s
    const largo = Math.floor(ctx.sampleRate * 1.3);
    const impulso = ctx.createBuffer(2, largo, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const datos = impulso.getChannelData(c);
      for (let i = 0; i < largo; i++) datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 3);
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulso;
    const retorno = ctx.createGain();
    retorno.gain.value = 0.5;
    this.entradaReverb = ctx.createGain();
    this.entradaReverb.connect(convolver);
    convolver.connect(retorno);
    retorno.connect(this.maestro);

    // compresor al final de todo: varias capas juntas (un disparo) no saturan la salida
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.maestro.disconnect();
    this.maestro.connect(comp);
    comp.connect(ctx.destination);
  },

  // Envia un nodo a la salida (y, si se pide, un poco a la reverberacion)
  salida(nodo, reverb = 0) {
    nodo.connect(this.maestro);
    if (reverb > 0 && this.entradaReverb) {
      const envio = this.ctx.createGain();
      envio.gain.value = reverb;
      nodo.connect(envio);
      envio.connect(this.entradaReverb);
    }
  },

  // Ruido filtrado con envolvente: la base de casi todos los efectos.
  //   buffer (ruidoRosa por defecto) | tipo de filtro | f0 -> f1 barrido de frecuencia | q | vol
  //   ataque (s) | dur (s) | retraso (s) | pan (-1..1) | reverb (0..1)
  ruidoFiltrado(o) {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.retraso || 0);
    const buffer = o.buffer || this.ruidoRosa || this.ruidoBlanco;
    const dur = Math.max(0.02, o.dur);
    const src = this.fuente(buffer, false);
    const f = ctx.createBiquadFilter();
    f.type = o.tipo || "bandpass";
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const vol = Math.max(PISO * 2, o.vol);
    const ataque = Math.min(o.ataque ?? 0.005, dur * 0.5);
    g.gain.setValueAtTime(PISO, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(PISO, t + dur);
    let nodo = src.connect(f).connect(g);
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      nodo.connect(p);
      nodo = p;
    }
    this.salida(nodo, o.reverb || 0);
    const libre = Math.max(0, (buffer.duration || dur) - dur - 0.1);
    src.start(t, Math.random() * libre, dur + 0.05);
  },

  // Tono con barrido de frecuencia y envolvente (golpes graves, burbujas, campanitas)
  barrido(o) {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.retraso || 0);
    const dur = Math.max(0.02, o.dur);
    const osc = ctx.createOscillator();
    osc.type = o.tipo || "sine";
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ctx.createGain();
    const vol = Math.max(PISO * 2, o.vol);
    const ataque = Math.min(o.ataque ?? 0.003, dur * 0.5);
    g.gain.setValueAtTime(PISO, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(PISO, t + dur);
    let nodo = osc.connect(g);
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      nodo.connect(p);
      nodo = p;
    }
    this.salida(nodo, o.reverb || 0);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  },

  // Burbuja de agua: un tono corto cuya frecuencia SUBE (asi suenan de verdad las burbujas)
  burbuja(retraso, vol = 0.1, grave = false) {
    const f0 = grave ? azar(220, 520) : azar(450, 1500);
    this.barrido({ retraso, f0, f1: f0 * azar(1.5, 2.3), dur: azar(0.05, 0.13), vol, ataque: 0.004, pan: azar(-0.3, 0.3) });
  },

  // ---------------------------------------------------------------- agua
  // Caida al agua o salida de ella. fuerza: 0.5 = salir despacio, 1 = zambullirse
  chapoteo(fuerza = 1) {
    if (!this.ctx) return;
    const f = Math.max(0.2, Math.min(1.6, fuerza));
    // el cuerpo golpeando el agua: un golpe grave y una columna de agua
    this.barrido({ f0: 170, f1: 55, dur: 0.22, vol: 0.45 * f, reverb: 0.15 });
    this.ruidoFiltrado({ tipo: "lowpass", f0: 700, f1: 200, dur: 0.3, vol: 0.5 * f, ataque: 0.004 });
    // la salpicadura: ruido ancho que se vuelve mas grave al caer el agua
    this.ruidoFiltrado({ tipo: "bandpass", f0: 3200, f1: 800, q: 0.6, dur: 0.35 + 0.35 * f, vol: 0.5 * f, ataque: 0.008, reverb: 0.2 });
    // el rocio: gotitas muy agudas
    this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "highpass", f0: 5500, dur: 0.3, vol: 0.14 * f, ataque: 0.02, retraso: 0.02 });
    // burbujas y gotas que caen despues, repartidas con el reloj de audio
    const burbujas = 4 + Math.floor(5 * Math.min(f, 1.2));
    for (let i = 0; i < burbujas; i++) this.burbuja(azar(0.04, 0.55), azar(0.04, 0.11) * f, Math.random() < 0.3);
    const gotas = 3 + Math.floor(3 * Math.min(f, 1.2));
    for (let i = 0; i < gotas; i++) {
      const f0 = azar(1600, 3600);
      this.barrido({ retraso: azar(0.12, 0.8), f0, f1: f0 * 1.5, dur: azar(0.04, 0.08), vol: azar(0.03, 0.07) * f, pan: azar(-0.4, 0.4) });
    }
  },

  // Brazada al nadar: el agua se abre y se cierra, con algo de burbuja. Alterna oido izquierdo y derecho.
  brazada() {
    if (!this.ctx) return;
    this.ladoBrazada = -(this.ladoBrazada || 1);
    const pan = this.ladoBrazada * 0.3;
    this.ruidoFiltrado({ tipo: "bandpass", f0: azar(420, 600), f1: azar(1100, 1600), q: 1.1, dur: 0.5, vol: 0.3, ataque: 0.11, pan, reverb: 0.12 });
    this.ruidoFiltrado({ tipo: "lowpass", f0: 1800, f1: 600, dur: 0.07, vol: 0.12, ataque: 0.004, pan });    // la mano entra al agua
    this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "highpass", f0: 4500, dur: 0.14, vol: 0.05, ataque: 0.03, retraso: 0.05, pan });
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.burbuja(azar(0.1, 0.45), azar(0.03, 0.07), Math.random() < 0.5);
  },

  // ---------------------------------------------------------------- movimiento
  // Paso. superficie: "arena" | "pasto" | "nieve" | "roca" | "tierra" ; corre: pisada mas fuerte y corta
  paso(superficie = "tierra", corre = false) {
    if (!this.ctx) return;
    this.ladoPaso = -(this.ladoPaso || 1);
    const pan = this.ladoPaso * 0.12;
    const v = azar(0.82, 1.18) * (corre ? 1.4 : 1);                // cada pisada suena un poco distinta
    const corto = corre ? 0.8 : 1;
    const peso = (vol, f0 = 95) => this.barrido({ f0: f0 * azar(0.9, 1.1), f1: f0 * 0.5, dur: 0.07 * corto, vol: vol * v, pan });   // el golpe del talon
    if (superficie === "arena") {
      this.ruidoFiltrado({ tipo: "bandpass", f0: azar(1700, 2200), f1: 800, q: 0.7, dur: 0.14 * corto, vol: 0.2 * v, ataque: 0.012, pan });
      this.ruidoFiltrado({ tipo: "lowpass", f0: 450, dur: 0.07 * corto, vol: 0.2 * v, pan });
      peso(0.1);
    } else if (superficie === "pasto") {
      this.ruidoFiltrado({ tipo: "bandpass", f0: azar(2300, 3000), f1: 1500, q: 0.9, dur: 0.1 * corto, vol: 0.16 * v, ataque: 0.008, pan });
      this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "highpass", f0: 6500, dur: 0.06 * corto, vol: 0.05 * v, pan });
      peso(0.14);
    } else if (superficie === "nieve") {
      // la nieve cruje: varios granitos muy cortos y agudos casi a la vez
      const granos = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < granos; i++) {
        this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "highpass", f0: azar(3000, 5500), dur: azar(0.025, 0.05), vol: azar(0.08, 0.15) * v, retraso: i * azar(0.008, 0.02), pan });
      }
      peso(0.08, 85);
    } else if (superficie === "roca") {
      this.ruidoFiltrado({ tipo: "bandpass", f0: azar(1200, 1800), q: 1.6, dur: 0.06 * corto, vol: 0.22 * v, ataque: 0.002, pan });
      peso(0.2, 120);
    } else {
      this.ruidoFiltrado({ tipo: "bandpass", f0: azar(900, 1400), q: 0.8, dur: 0.09 * corto, vol: 0.22 * v, ataque: 0.006, pan });
      peso(0.16);
    }
  },

  // Impulso al saltar: un empujon de los pies, la ropa que se mueve y un soplo de esfuerzo
  salto() {
    if (!this.ctx) return;
    this.barrido({ f0: 140, f1: 65, dur: 0.12, vol: 0.22 });
    this.ruidoFiltrado({ tipo: "lowpass", f0: 600, dur: 0.1, vol: 0.2, ataque: 0.004 });
    this.ruidoFiltrado({ tipo: "bandpass", f0: 1200, f1: 2800, q: 0.8, dur: 0.16, vol: 0.1, ataque: 0.03 });
    this.ruidoFiltrado({ tipo: "bandpass", f0: 850, f1: 1000, q: 3, dur: 0.14, vol: 0.05, ataque: 0.05, retraso: 0.02 });
  },

  // Caida al suelo. fuerza = 1 es un salto normal; mas alto, mas fuerte
  aterrizaje(fuerza = 1) {
    if (!this.ctx) return;
    const f = Math.max(0.3, Math.min(1.6, fuerza));
    this.barrido({ f0: 120, f1: 42, dur: 0.22, vol: 0.5 * f, reverb: 0.08 });
    this.ruidoFiltrado({ tipo: "lowpass", f0: 520, dur: 0.16, vol: 0.5 * f, ataque: 0.003 });
    this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "highpass", f0: 2600, dur: 0.12, vol: 0.07 * f, ataque: 0.01 });
  },

  // ---------------------------------------------------------------- combate
  // El golpe cortando el aire. arma: "cuchillo" | "machete" | "bate" | otro = puños
  golpe(arma) {
    if (!this.ctx) return;
    if (arma === "cuchillo") {
      this.ruidoFiltrado({ tipo: "bandpass", f0: 1600, f1: 4800, q: 2, dur: 0.1, vol: 0.16, ataque: 0.03 });
    } else if (arma === "machete") {
      this.ruidoFiltrado({ tipo: "bandpass", f0: 900, f1: 3200, q: 1.5, dur: 0.17, vol: 0.2, ataque: 0.05 });
      this.barrido({ f0: 2300, f1: 2200, dur: 0.3, vol: 0.02, ataque: 0.06 });
    } else if (arma === "bate") {
      this.ruidoFiltrado({ tipo: "bandpass", f0: 300, f1: 900, q: 0.9, dur: 0.24, vol: 0.32, ataque: 0.08 });
    } else {
      this.ruidoFiltrado({ tipo: "bandpass", f0: 500, f1: 1900, q: 1, dur: 0.15, vol: 0.2, ataque: 0.06 });
    }
  },

  // El golpe conectando con un cuerpo: un golpe sordo, carne y un chasquido corto
  impacto(arma) {
    if (!this.ctx) return;
    const filo = arma === "cuchillo" || arma === "machete";
    this.barrido({ f0: arma === "bate" ? 130 : 175, f1: 52, dur: arma === "bate" ? 0.22 : 0.16, vol: 0.5 });
    this.ruidoFiltrado({ tipo: "lowpass", f0: 1500, f1: 400, dur: 0.14, vol: 0.55, ataque: 0.002 });
    this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "highpass", f0: 3200, dur: 0.02, vol: 0.25, ataque: 0.001 });
    if (filo) this.ruidoFiltrado({ tipo: "bandpass", f0: 3800, f1: 2000, q: 1.5, dur: 0.12, vol: 0.16, ataque: 0.004 });
    if (arma === "bate") this.barrido({ f0: 240, f1: 200, dur: 0.06, vol: 0.18, tipo: "triangle" });   // la madera
  },

  // Disparo de pistola: chasquido seco, estallido, retumbo grave y eco
  disparo() {
    if (!this.ctx) return;
    const v = azar(0.92, 1.08);
    this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "highpass", f0: 1100, dur: 0.07, vol: 0.9 * v, ataque: 0.001, reverb: 0.4 });   // el chasquido
    this.ruidoFiltrado({ buffer: this.ruidoBlanco, tipo: "lowpass", f0: 5000, f1: 380, dur: 0.24, vol: 0.75 * v, ataque: 0.002, reverb: 0.5 });
    this.barrido({ f0: 150 * v, f1: 40, dur: 0.3, vol: 0.65, tipo: "sine", reverb: 0.3 });
    this.ruidoFiltrado({ tipo: "bandpass", f0: 4200, q: 3, dur: 0.018, vol: 0.1, retraso: 0.07 });   // el mecanismo
  },

  // ---------------------------------------------------------------- objetos
  // Recoger un kit de arma: metal que se agarra y un clic de mecanismo
  recogerArma() {
    if (!this.ctx) return;
    this.ruidoFiltrado({ tipo: "bandpass", f0: 3500, q: 4, dur: 0.03, vol: 0.25, ataque: 0.001 });
    this.ruidoFiltrado({ tipo: "bandpass", f0: 2400, q: 3, dur: 0.035, vol: 0.2, ataque: 0.001, retraso: 0.08 });
    this.barrido({ f0: 1800, f1: 900, dur: 0.05, vol: 0.1, tipo: "triangle", retraso: 0.08 });
    this.barrido({ f0: 2200, f1: 2150, dur: 0.3, vol: 0.05, retraso: 0.02, reverb: 0.2 });         // metal que vibra
    this.ruidoFiltrado({ tipo: "lowpass", f0: 500, dur: 0.1, vol: 0.2 });
  },

  // Ponerse o guardar el sombrero, o cambiar de arma: tela que roza y un toque suave de objeto
  equipar() {
    if (!this.ctx) return;
    this.ruidoFiltrado({ tipo: "bandpass", f0: azar(1400, 1900), f1: 900, q: 0.7, dur: 0.16, vol: 0.14, ataque: 0.04 });
    this.ruidoFiltrado({ tipo: "lowpass", f0: 500, dur: 0.06, vol: 0.12, retraso: 0.1 });
  },

  // Recoger un botiquin: la tela y el plastico, y una nota suave que reconforta
  recogerBotiquin() {
    if (!this.ctx) return;
    this.ruidoFiltrado({ tipo: "bandpass", f0: 1800, f1: 2600, q: 0.8, dur: 0.2, vol: 0.12, ataque: 0.04 });
    this.ruidoFiltrado({ tipo: "lowpass", f0: 700, dur: 0.07, vol: 0.14 });
    [523.25, 659.25].forEach((f, i) => this.barrido({ f0: f, f1: f * 1.004, dur: 0.45, vol: 0.12, ataque: 0.02, retraso: 0.12 + i * 0.1, reverb: 0.25 }));
  }
};

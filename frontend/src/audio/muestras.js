// Sonidos de agua reales (public/sounds). Se cargan en segundo plano despues del primer clic; mientras
// no llegan (o si fallan) sigue sonando el agua sintetizada de audio.js, asi el juego nunca queda mudo.
//   oceano-lite  -> mar (bucle, siempre)
//   aire-lite / nada-lite -> chapoteo y brazadas
// Los *-lite son versiones livianas (mono, 22 kHz) de los originales.
export const MUESTRAS_AGUA = {
  mar: "sounds/oceano-lite.wav",
  fuego: "sounds/fuego-lite.wav",
  golpes: "sounds/aire-lite.wav",
  nadar: "sounds/nada-lite.wav"
};

// Descarga y decodifica una muestra. Devuelve null si algo falla (nunca lanza).
export async function cargarMuestra(ctx, url, descargar = globalThis.fetch) {
  try {
    const r = await descargar(url);
    if (!r.ok) return null;
    return await ctx.decodeAudioData(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// Offset y duracion de un trozo al azar dentro de una muestra de `largo` segundos
export function elegirTrozo(largo, dur, azar = Math.random) {
  const d = Math.min(dur, largo);
  return { inicio: azar() * Math.max(0, largo - d), dur: d };
}

export const efectosMuestras = {
  base() {
    return import.meta.env?.BASE_URL ?? "/";
  },

  async cargarMuestrasAgua(urls = MUESTRAS_AGUA) {
    this.muestras = this.muestras || {};
    const base = this.base();
    await Promise.all(Object.entries(urls).map(async ([clave, url]) => {
      const b = await cargarMuestra(this.ctx, base + url);
      if (b) this.muestras[clave] = b;
    }));
    this.conectarMuestrasAgua();
  },

  // bucle continuo que se mezcla en el canal (mar u oasis) y deja callada la version sintetizada
  bucleMuestra(buffer, destino, vol) {
    const s = this.fuente(buffer);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(destino);
    s.start();
  },

  conectarMuestrasAgua() {
    const m = this.muestras || {};
    if (m.fuego && this.fuego) {      // fogata real: sigue el volumen por distancia de this.fuego; el crepitar sintetico casi calla
      this.bucleMuestra(m.fuego, this.fuego, 1);
      this.fuegoSint?.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.5);
    }
    if (m.mar && this.mar) {
      this.bucleMuestra(m.mar, this.mar, 0.9);
      this.gOceanoSint?.gain.setTargetAtTime(0.04, this.ctx.currentTime, 0.5);
    }
  },

  // Un trozo corto de una muestra, con entrada y salida suaves para que no haya clics
  trozoMuestra(clave, { dur = 1, vol = 0.5, pan = 0, vel = 1 } = {}) {
    const buffer = this.muestras?.[clave];
    if (!this.ctx || !buffer) return false;
    const { inicio, dur: d } = elegirTrozo(buffer.duration, dur);
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = vel;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.03, d / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let nodo = g;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      nodo = p;
    }
    s.connect(g);
    this.salida(nodo, 0.1);
    s.start(t, inicio, d);
    return true;
  }
};

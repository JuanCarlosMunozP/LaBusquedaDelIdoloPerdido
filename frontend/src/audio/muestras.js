// Sonidos de agua reales (public/sounds). Se cargan en segundo plano despues del primer clic; mientras
// no llegan (o si fallan) sigue sonando el agua sintetizada de audio.js, asi el juego nunca queda mudo.
//   oceano-lite  -> mar (bucle, siempre)
//   aire-lite / nada-lite -> chapoteo y brazadas
// Los *-lite son versiones livianas (mono, 22 kHz) de los originales.
export const MUESTRAS_AGUA = {
  mar: "sounds/oceano-lite.wav",
  fuego: "sounds/fuego-lite.wav",
  golpes: "sounds/aire-lite.wav",
  nadar: "sounds/nada-lite.wav",
  oasis: "sounds/oasis-lite.wav",         // estanque del oasis (bucle, segun la cercania al agua)
  desierto: "sounds/desierto-lite.wav",   // viento del desierto (bucle, solo en ese nivel)
  disparo: "sounds/shot.wav"              // disparo (0 - 0.56 s) y, despues, los clics de la recarga
};

// Trozos de shot.wav (segundos): el disparo y los tres momentos de la recarga (cargador que sale,
// cargador nuevo que entra y corredera). Los cortes caen en silencios del archivo.
export const TROZOS_ARMA = {
  disparo: [0, 0.56],
  cargadorFuera: [0.56, 0.9],
  cargadorDentro: [0.9, 1.2],
  corredera: [1.2, 1.53]
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
    if (m.oasis && this.oasis) {      // oasis real: el volumen lo da this.oasis (ajustarAgua); el murmullo sintetico se calla
      this.bucleMuestra(m.oasis, this.oasis, 0.4);
      this.gOasisSint?.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.5);
    }
    if (m.desierto) {                 // viento del desierto: canal propio, se abre solo en el nivel del desierto
      this.desierto = this.ctx.createGain();
      this.desierto.gain.value = 0;
      this.desierto.connect(this.maestro);
      this.bucleMuestra(m.desierto, this.desierto, 0.9);
      this.ajustarAmbiente(this.nivelAmbiente);
    }
    if (m.mar && this.mar) {
      this.bucleMuestra(m.mar, this.mar, 0.9);
      this.gOceanoSint?.gain.setTargetAtTime(0.04, this.ctx.currentTime, 0.5);
    }
  },

  // Ambiente del nivel actual ("desierto" u otro): el viento del desierto solo suena alli
  ajustarAmbiente(tipo) {
    this.nivelAmbiente = tipo;
    if (this.desierto) this.desierto.gain.setTargetAtTime(tipo === "desierto" ? 0.55 : 0, this.ctx.currentTime, 0.6);
  },

  // Un trozo fijo de una muestra ([inicio, fin] en segundos), con fundidos cortos. `retraso` en segundos.
  // Devuelve false si la muestra no llego (quien llama usa el sonido sintetizado).
  trozoFijo(clave, [inicio, fin], { vol = 1, retraso = 0, vel = 1 } = {}) {
    const buffer = this.muestras?.[clave];
    if (!this.ctx || !buffer) return false;
    const d = (fin - inicio) / vel, t = this.ctx.currentTime + retraso;
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = vel;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, t + d - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t + d);
    s.connect(g);
    this.salida(g, 0.1);
    s.start(t, inicio, fin - inicio);
    return true;
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

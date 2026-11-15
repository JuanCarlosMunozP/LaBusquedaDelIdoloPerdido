import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sonido } from '../src/audio/audio.js';

// Simulador estricto de Web Audio: lanza los mismos errores que el navegador (valores no finitos,
// rampas exponenciales hacia 0 o negativos, tiempos negativos...) para cazarlos sin abrir el juego.
const finito = (...v) => v.forEach((x) => { if (!Number.isFinite(x)) throw new TypeError(`valor no finito: ${x}`); });

class Param {
  // `maximo` solo registra lo que el efecto programa (no el valor por defecto del nodo)
  constructor(valor = 0) { this._v = valor; this.maximo = 0; }
  get value() { return this._v; }
  set value(v) { finito(v); this._v = v; this.anotar(v); }
  anotar(v) { this.maximo = Math.max(this.maximo, v); }
  setValueAtTime(v, t) { finito(v, t); if (t < 0) throw new RangeError('tiempo negativo'); this.anotar(v); return this; }
  linearRampToValueAtTime(v, t) { finito(v, t); this.anotar(v); return this; }
  exponentialRampToValueAtTime(v, t) {
    finito(v, t);
    if (!(v > 0)) throw new RangeError(`exponentialRamp hacia ${v}`);
    return this;
  }
  setTargetAtTime(v, t, c) { finito(v, t, c); return this; }
}

class Nodo {
  constructor(ctx) { this.ctx = ctx; this.destinos = []; ctx.nodos.push(this); }
  connect(destino) { this.destinos.push(destino); return destino; }
  disconnect() { this.destinos = []; }
}
class Ganancia extends Nodo { constructor(c) { super(c); this.gain = new Param(1); } }
class Filtro extends Nodo {
  constructor(c) { super(c); this.type = 'lowpass'; this.frequency = new Param(350); this.Q = new Param(1); }
}
class Oscilador extends Nodo {
  constructor(c) { super(c); this.type = 'sine'; this.frequency = new Param(440); }
  start(t) { finito(t); this.inicio = t; this.ctx.inicios.push(t); }
  stop(t) { finito(t); if (t < this.inicio) throw new RangeError('stop antes de start'); }
}
class Fuente extends Nodo {
  constructor(c) { super(c); this.buffer = null; this.loop = false; }
  start(t, desde = 0, dur = 1) {
    finito(t, desde, dur);
    if (desde < 0 || dur <= 0) throw new RangeError('start con desfase o duracion invalidos');
    this.ctx.inicios.push(t);
  }
}
class Convolver extends Nodo {}
class Paneo extends Nodo { constructor(c) { super(c); this.pan = new Param(0); } }
class Compresor extends Nodo {
  constructor(c) {
    super(c);
    for (const p of ['threshold', 'knee', 'ratio', 'attack', 'release']) this[p] = new Param(0);
  }
}

class CtxFalso {
  constructor() {
    this.sampleRate = 8000;
    this.currentTime = 0;
    this.nodos = [];
    this.inicios = [];
    this.destination = new Nodo(this);
  }
  createGain() { return new Ganancia(this); }
  createBiquadFilter() { return new Filtro(this); }
  createOscillator() { return new Oscilador(this); }
  createBufferSource() { return new Fuente(this); }
  createConvolver() { return new Convolver(this); }
  createStereoPanner() { return new Paneo(this); }
  createDynamicsCompressor() { return new Compresor(this); }
  createBuffer(canales, largo, tasa) {
    return { duration: largo / tasa, getChannelData: () => new Float32Array(largo) };
  }
}

function crearSonido() {
  const s = new Sonido();
  s.ctx = new CtxFalso();
  s.maestro = s.ctx.createGain();
  s.maestro.connect(s.ctx.destination);
  s.ruido = s.crearRuido();
  s.crearBlanco();
  s.crearEfectos();
  // el volumen de la cadena fija (retorno de reverb...) no cuenta: solo lo que programe cada efecto
  for (const n of s.ctx.nodos) for (const p of Object.values(n)) if (p instanceof Param) p.maximo = 0;
  return s;
}

const contar = (s, clase) => s.ctx.nodos.filter((n) => n instanceof clase).length;
const picoGanancia = (s) => Math.max(0, ...s.ctx.nodos.filter((n) => n instanceof Ganancia).map((n) => n.gain.maximo));

afterEach(() => vi.restoreAllMocks());

describe('cadena de salida', () => {
  it('crea ruido rosa finito, reverberacion y un compresor al final', () => {
    const s = crearSonido();
    expect(s.ruidoRosa.duration).toBeGreaterThan(2);
    expect(s.entradaReverb).toBeDefined();
    const compresor = s.ctx.nodos.find((n) => n instanceof Compresor);
    expect(s.maestro.destinos).toContain(compresor);
    expect(compresor.destinos).toContain(s.ctx.destination);
    expect(s.maestro.destinos).not.toContain(s.ctx.destination);   // ya no sale directo
  });

  it('sin audio iniciado no falla ni hace nada', () => {
    const s = new Sonido();
    for (const f of ['chapoteo', 'brazada', 'paso', 'salto', 'aterrizaje', 'golpe', 'impacto', 'disparo', 'recogerArma', 'recogerBotiquin', 'equipar']) {
      expect(() => s[f]()).not.toThrow();
    }
  });
});

describe('cada efecto es valido para el navegador', () => {
  const efectos = {
    'chapoteo suave': (s) => s.chapoteo(0.5),
    'chapoteo normal': (s) => s.chapoteo(1),
    'chapoteo fuerte': (s) => s.chapoteo(1.6),
    'chapoteo con fuerza rara': (s) => s.chapoteo(0),
    brazada: (s) => s.brazada(),
    'paso arena': (s) => s.paso('arena'),
    'paso pasto': (s) => s.paso('pasto'),
    'paso nieve': (s) => s.paso('nieve'),
    'paso roca': (s) => s.paso('roca'),
    'paso sin superficie': (s) => s.paso(),
    'paso corriendo': (s) => s.paso('arena', true),
    salto: (s) => s.salto(),
    'aterrizaje suave': (s) => s.aterrizaje(0.3),
    'aterrizaje fuerte': (s) => s.aterrizaje(1.6),
    'aterrizaje sin dato': (s) => s.aterrizaje(),
    'golpe punos': (s) => s.golpe(),
    'golpe cuchillo': (s) => s.golpe('cuchillo'),
    'golpe machete': (s) => s.golpe('machete'),
    'golpe bate': (s) => s.golpe('bate'),
    'impacto punos': (s) => s.impacto(),
    'impacto cuchillo': (s) => s.impacto('cuchillo'),
    'impacto bate': (s) => s.impacto('bate'),
    disparo: (s) => s.disparo(),
    'recoger arma': (s) => s.recogerArma(),
    'recoger botiquin': (s) => s.recogerBotiquin(),
    'equipar sombrero o arma': (s) => s.equipar()
  };

  it.each(Object.entries(efectos))('%s: sin errores, con nodos y volumen acotado (40 repeticiones)', (_n, tocar) => {
    const espia = vi.spyOn(globalThis, 'setTimeout');
    for (let i = 0; i < 40; i++) {
      const s = crearSonido();
      const antes = s.ctx.nodos.length;
      expect(() => tocar(s)).not.toThrow();
      const nuevos = s.ctx.nodos.length - antes;
      expect(nuevos).toBeGreaterThan(0);
      expect(nuevos).toBeLessThan(120);                    // un efecto no debe crear cientos de nodos
      expect(picoGanancia(s)).toBeLessThanOrEqual(1);      // ninguna capa pasa de volumen 1
      expect(Math.max(0, ...s.ctx.inicios)).toBeLessThan(1.6);   // todo suena en menos de 1.6 s
    }
    expect(espia).not.toHaveBeenCalled();                  // se programa con el reloj de audio, no con setTimeout
  });
});

describe('caracter de cada efecto', () => {
  it('el chapoteo fuerte es mas fuerte que el suave y tiene mas burbujas', () => {
    const a = crearSonido(), b = crearSonido();
    a.chapoteo(0.5); b.chapoteo(1.5);
    expect(picoGanancia(b)).toBeGreaterThan(picoGanancia(a));
    expect(contar(b, Oscilador)).toBeGreaterThanOrEqual(contar(a, Oscilador));
  });

  it('las burbujas suben de frecuencia (asi suena el agua)', () => {
    const s = crearSonido();
    s.burbuja(0, 0.1);
    const o = s.ctx.nodos.find((n) => n instanceof Oscilador);
    expect(o.frequency.maximo).toBeGreaterThan(300);
    const g = s.ctx.nodos.filter((n) => n instanceof Ganancia).pop();
    expect(g.gain.maximo).toBeLessThanOrEqual(0.1);
  });

  it('la brazada alterna entre el oido izquierdo y el derecho', () => {
    const s = crearSonido();
    s.brazada();
    const p1 = s.ctx.nodos.find((n) => n instanceof Paneo).pan.value;
    const s2 = crearSonido();
    s2.ladoBrazada = s.ladoBrazada;       // continua la alternancia
    s2.brazada();
    const p2 = s2.ctx.nodos.find((n) => n instanceof Paneo).pan.value;
    expect(Math.sign(p1)).toBe(-Math.sign(p2));
  });

  it('la nieve cruje con mas granitos que la arena', () => {
    const a = crearSonido(), n = crearSonido();
    for (let i = 0; i < 10; i++) { a.paso('arena'); n.paso('nieve'); }
    expect(contar(n, Fuente)).toBeGreaterThan(contar(a, Fuente));
  });

  it('correr suena mas fuerte que caminar', () => {
    let caminar = 0, correr = 0;
    for (let i = 0; i < 30; i++) {
      const a = crearSonido(), b = crearSonido();
      a.paso('arena', false); b.paso('arena', true);
      caminar += picoGanancia(a); correr += picoGanancia(b);
    }
    expect(correr).toBeGreaterThan(caminar);
  });

  it('un aterrizaje desde mas alto suena mas fuerte', () => {
    const a = crearSonido(), b = crearSonido();
    a.aterrizaje(0.4); b.aterrizaje(1.5);
    expect(picoGanancia(b)).toBeGreaterThan(picoGanancia(a));
  });

  it('el bate suena mas grave que el cuchillo', () => {
    const f0 = (arma) => {
      const s = crearSonido();
      s.golpe(arma);
      return s.ctx.nodos.find((n) => n instanceof Filtro).frequency.maximo;
    };
    expect(f0('bate')).toBeLessThan(f0('cuchillo'));
  });

  it('el disparo manda parte de su sonido a la reverberacion', () => {
    const s = crearSonido();
    s.disparo();
    const envios = s.ctx.nodos.filter((n) => n.destinos && n.destinos.includes(s.entradaReverb));
    expect(envios.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { cargarMuestra, elegirTrozo, efectosMuestras, MUESTRAS_AGUA } from '../src/audio/muestras.js';

describe('muestras de agua', () => {
  it('cargarMuestra decodifica lo descargado y devuelve null si falla, sin lanzar', async () => {
    const ctx = { decodeAudioData: vi.fn(async () => ({ duration: 3 })) };
    const bueno = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    expect(await cargarMuestra(ctx, 'a.wav', bueno)).toEqual({ duration: 3 });
    expect(await cargarMuestra(ctx, 'a.wav', async () => ({ ok: false }))).toBeNull();
    expect(await cargarMuestra(ctx, 'a.wav', async () => { throw new Error('red'); })).toBeNull();
    expect(await cargarMuestra({ decodeAudioData: async () => { throw new Error('mal'); } }, 'a', bueno)).toBeNull();
  });

  it('elegirTrozo nunca se sale de la muestra', () => {
    expect(elegirTrozo(10, 2, () => 0)).toEqual({ inicio: 0, dur: 2 });
    expect(elegirTrozo(10, 2, () => 1)).toEqual({ inicio: 8, dur: 2 });
    expect(elegirTrozo(1, 5, () => 0.9)).toEqual({ inicio: 0, dur: 1 });
  });

  it('sin muestra cargada trozoMuestra no suena (queda el sonido sintetizado)', () => {
    const yo = { ctx: {}, muestras: {} };
    expect(efectosMuestras.trozoMuestra.call(yo, 'golpes')).toBe(false);
    expect(efectosMuestras.trozoMuestra.call({ ctx: null }, 'golpes')).toBe(false);
  });

  it('conectarMuestrasAgua mezcla los bucles y baja el sonido sintetico', () => {
    const arranca = vi.fn();
    const nodo = () => ({ gain: { value: 0, setTargetAtTime: vi.fn() }, connect(x) { return x; } });
    const yo = {
      ctx: { currentTime: 0, createGain: nodo },
      muestras: { mar: {} }, mar: nodo(), oasis: nodo(), gOceanoSint: nodo(),
      fuente: () => ({ connect: (g) => g, start: arranca }),
      bucleMuestra: efectosMuestras.bucleMuestra
    };
    efectosMuestras.conectarMuestrasAgua.call(yo);
    expect(arranca).toHaveBeenCalledTimes(1);   // solo el mar
    expect(yo.gOceanoSint.gain.setTargetAtTime).toHaveBeenCalled();
  });

  it('las rutas apuntan a archivos que existen en public/sounds', async () => {
    const { existsSync } = await import('node:fs');
    for (const ruta of Object.values(MUESTRAS_AGUA)) expect(existsSync(new URL(`../public/${ruta}`, import.meta.url))).toBe(true);
  });
});

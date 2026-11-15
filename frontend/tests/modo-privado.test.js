import { describe, expect, it } from 'vitest';
import { detectarModoPrivado, debeBloquear } from '../src/seguridad/modoPrivado.js';
import { modeloModal } from '../src/interfaz/modalModo.js';

const GB = 1024 ** 3;
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const EDGE = `${CHROME} Edg/126.0`;
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0';
const SAFARI = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

const chromium = (ua, quota, heap = 4 * GB) => ({
  nav: { userAgent: ua, storage: { estimate: async () => ({ quota }) } },
  win: { performance: { memory: { jsHeapSizeLimit: heap } }, isSecureContext: true }
});

describe('deteccion de ventana privada (de buena fe, nunca por duda)', () => {
  it('Chrome/Edge normal: cuota enorme -> no es privado', async () => {
    for (const ua of [CHROME, EDGE]) {
      const r = await detectarModoPrivado(chromium(ua, 200 * GB));
      expect(r.privado).toBe(false);
      expect(debeBloquear(r)).toBe(false);
    }
  });

  it('Chrome/Edge privado (InPrivate): cuota pequeña -> privado', async () => {
    const r = await detectarModoPrivado(chromium(EDGE, 0.3 * GB));
    expect(r.privado).toBe(true);
    expect(debeBloquear(r)).toBe(true);
  });

  it('sin dato del heap usa un limite razonable (2 GB)', async () => {
    const sinHeap = (quota) => ({ nav: chromium(CHROME, quota).nav, win: { isSecureContext: true } });
    expect((await detectarModoPrivado(sinHeap(0.2 * GB))).privado).toBe(true);
    expect((await detectarModoPrivado(sinHeap(50 * GB))).privado).toBe(false);
  });

  it('Firefox: sin serviceWorker es privado, con serviceWorker no', async () => {
    const win = { isSecureContext: true };
    expect((await detectarModoPrivado({ nav: { userAgent: FIREFOX }, win })).privado).toBe(true);
    expect((await detectarModoPrivado({ nav: { userAgent: FIREFOX, serviceWorker: {} }, win })).privado).toBe(false);
    expect((await detectarModoPrivado({ nav: { userAgent: FIREFOX }, win: { isSecureContext: false } })).privado).toBeNull();
  });

  it('Safari y navegadores desconocidos: no se sabe -> null y NO se bloquea', async () => {
    const r = await detectarModoPrivado({ nav: { userAgent: SAFARI }, win: {} });
    expect(r.privado).toBeNull();
    expect(debeBloquear(r)).toBe(false);
  });

  it('datos raros o errores: null, nunca bloquea ni lanza', async () => {
    expect((await detectarModoPrivado({ nav: null })).privado).toBeNull();
    expect((await detectarModoPrivado({ nav: { userAgent: CHROME } , win: {} })).privado).toBeNull();
    expect((await detectarModoPrivado(chromium(CHROME, NaN))).privado).toBeNull();
    expect((await detectarModoPrivado(chromium(CHROME, -1))).privado).toBeNull();
    const roto = { nav: { userAgent: CHROME, storage: { estimate: async () => { throw new Error('x'); } } }, win: {} };
    const r = await detectarModoPrivado(roto);
    expect(r.privado).toBeNull();
    expect(debeBloquear(undefined)).toBe(false);
  });
});

describe('modelo de la ventana de modo de juego', () => {
  it('ofrece un jugador y multijugador (este ultimo apagado hasta que exista)', () => {
    const m = modeloModal({ privado: false, multijugador: false });
    expect(m.bloqueado).toBe(false);
    expect(m.opciones.map((o) => [o.id, o.activa])).toEqual([['solo', true], ['multi', false]]);
    expect(modeloModal({ privado: false, multijugador: true }).opciones[1].activa).toBe(true);
  });

  it('en ventana privada no ofrece ninguna opcion y explica por que', () => {
    const m = modeloModal({ privado: true, multijugador: true });
    expect(m.bloqueado).toBe(true);
    expect(m.opciones).toEqual([]);
    expect(m.texto).toMatch(/ventana normal/);
  });
});

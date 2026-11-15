import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Separar por responsabilidades: ningun modulo nuevo debe pasar de 500 lineas. Los que ya pasaban
// tienen un tope (no pueden crecer) hasta que se dividan en una fase aparte.
const LIMITE = 500;
const YA_EXCEDIDOS = { 'main.js': 880, 'escenario/mundo.js': 510 };

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : ruta.endsWith('.js') ? [ruta] : [];
  });
}

describe('tamaño de los modulos del frontend', () => {
  const raiz = resolve(import.meta.dirname, '../src');
  const lineas = Object.fromEntries(
    archivos(raiz).map((a) => [relative(raiz, a).replaceAll('\\', '/'), readFileSync(a, 'utf8').split('\n').length])
  );

  it(`ningun modulo supera ${LIMITE} lineas (salvo los pendientes de dividir)`, () => {
    const largos = Object.entries(lineas).filter(([n, l]) => l > LIMITE && !(n in YA_EXCEDIDOS));
    expect(largos).toEqual([]);
  });

  it('los pendientes de dividir no crecen', () => {
    for (const [n, tope] of Object.entries(YA_EXCEDIDOS)) expect(lineas[n], n).toBeLessThanOrEqual(tope);
  });
});

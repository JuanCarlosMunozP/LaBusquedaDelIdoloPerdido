import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { crearObjetosSueltos } from '../src/juego/soltar.js';
import { aparienciaHumano } from '../src/personajes/apariencia.js';

const plano = () => 2;                                    // suelo a 2 m
const simular = (obj, suelo = plano, segundos = 6) => { for (let i = 0; i < segundos * 60; i++) obj.actualizar(1 / 60, suelo); };

function conMano() {
  const scene = new THREE.Scene();
  const hueso = new THREE.Group();
  hueso.position.set(1, 3.2, -4);
  hueso.scale.setScalar(2);                               // un hueso escalado no debe deformar el objeto
  scene.add(hueso);
  const malla = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05));
  hueso.add(malla);
  scene.updateMatrixWorld(true);
  return { scene, malla };
}

describe('objetos que Max suelta al morir', () => {
  it('pasan a la escena sin moverse ni cambiar de tamaño', () => {
    const { scene, malla } = conMano();
    const antes = malla.getWorldPosition(new THREE.Vector3()), escalaAntes = malla.getWorldScale(new THREE.Vector3());
    crearObjetosSueltos(scene).soltar(malla, { tipo: 'arma' });
    expect(malla.parent).toBe(scene);
    expect(malla.getWorldPosition(new THREE.Vector3()).distanceTo(antes)).toBeLessThan(1e-6);
    expect(malla.getWorldScale(new THREE.Vector3()).distanceTo(escalaAntes)).toBeLessThan(1e-6);
  });

  it('caen, no atraviesan el suelo en ningun cuadro y terminan quietos encima', () => {
    const { scene, malla } = conMano();
    const obj = crearObjetosSueltos(scene);
    obj.soltar(malla, { tipo: 'arma', grosor: 0.035, impulso: { x: 1, z: 0 } });
    let minimo = Infinity;
    for (let i = 0; i < 6 * 60; i++) { obj.actualizar(1 / 60, plano); minimo = Math.min(minimo, malla.position.y); }
    expect(minimo).toBeGreaterThanOrEqual(2.035 - 1e-9);
    expect(malla.position.y).toBeCloseTo(2.035, 3);
    for (const v of [malla.position.x, malla.position.y, malla.position.z]) expect(Number.isFinite(v)).toBe(true);
  });

  it('un arma queda acostada: su eje largo es horizontal', () => {
    for (let i = 0; i < 10; i++) {                        // distintos giros al azar
      const { scene, malla } = conMano();
      const obj = crearObjetosSueltos(scene);
      obj.soltar(malla, { tipo: 'arma' });
      simular(obj);
      const eje = new THREE.Vector3(0, 1, 0).applyQuaternion(malla.quaternion);
      expect(Math.abs(eje.y)).toBeLessThan(0.02);
    }
  });

  it('un sombrero queda plano con la copa hacia arriba', () => {
    for (let i = 0; i < 10; i++) {
      const { scene, malla } = conMano();
      const obj = crearObjetosSueltos(scene);
      obj.soltar(malla, { tipo: 'sombrero', grosor: 0.012 });
      simular(obj);
      const arriba = new THREE.Vector3(0, 1, 0).applyQuaternion(malla.quaternion);
      expect(arriba.y).toBeGreaterThan(0.99);
    }
  });

  it('el golpe los empuja hacia donde iba el ataque', () => {
    const { scene, malla } = conMano();
    const x0 = malla.getWorldPosition(new THREE.Vector3()).x;
    const obj = crearObjetosSueltos(scene);
    obj.soltar(malla, { tipo: 'arma', impulso: { x: 1, z: 0 }, fuerza: 3 });
    simular(obj);
    expect(malla.position.x).toBeGreaterThan(x0 + 0.5);
  });

  it('respetan un suelo irregular (terreno) y el agua como piso', () => {
    const { scene, malla } = conMano();
    const obj = crearObjetosSueltos(scene);
    obj.soltar(malla, { tipo: 'arma', grosor: 0 });
    simular(obj, (x) => Math.max(0.5 + Math.sin(x) * 0.2, 1.7));
    expect(malla.position.y).toBeGreaterThanOrEqual(1.7 - 1e-9);
  });

  it('con un cuadro muy largo no se tunelan ni dan NaN', () => {
    const { scene, malla } = conMano();
    const obj = crearObjetosSueltos(scene);
    obj.soltar(malla, { tipo: 'arma' });
    for (let i = 0; i < 200; i++) obj.actualizar(5, plano);
    expect(malla.position.y).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(malla.quaternion.x)).toBe(true);
  });

  it('soltar null no hace nada y limpiar los retira de la escena', () => {
    const { scene, malla } = conMano();
    const obj = crearObjetosSueltos(scene);
    expect(obj.soltar(null)).toBeNull();
    obj.soltar(malla);
    expect(obj.cantidad).toBe(1);
    obj.limpiar();
    expect(obj.cantidad).toBe(0);
    expect(malla.parent).toBeNull();
  });
});

describe('sombrero al morir (apariencia)', () => {
  const crear = (modo) => {
    const anexos = [];
    const malla = new THREE.Group();
    const sitio = { hueso: { add: (m) => anexos.push(m) }, matriz: new THREE.Matrix4() };
    return { anexos, malla, yo: { ...aparienciaHumano, sombrero: { malla, modo, cabeza: sitio, mano: sitio } } };
  };

  it('suelta el sombrero que se ve (cabeza o mano)', () => {
    for (const modo of ['cabeza', 'mano']) {
      const { yo, malla } = crear(modo);
      expect(yo.soltarSombrero()).toBe(malla);
    }
  });

  it('un sombrero guardado no suelta nada', () => {
    const { yo } = crear('oculto');
    expect(yo.soltarSombrero()).toBeNull();
  });

  it('despues de soltarlo, el modelo no lo vuelve a poner ni de la nada', () => {
    const { yo, anexos } = crear('cabeza');
    yo.soltarSombrero();
    for (const modo of ['cabeza', 'mano', 'oculto', 'cabeza']) yo.colocarSombrero(modo);
    expect(anexos).toHaveLength(0);
    expect(yo.soltarSombrero()).toBeNull();           // y no se suelta dos veces
  });
});

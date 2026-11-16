// Escena final: la cabaña de Max por dentro, con su cama, una lampara y el idolo en la repisa.
import * as THREE from 'three';
import { textura } from './utilidades.js';
import { cargarModelo } from './recursos.js';

// Sitio del sillon (mira hacia -z) y de la fogata, en coordenadas de la cabaña. `altura` = cara de arriba del asiento.
export const SILLON = { x: 0, z: 1.5, altura: 0.44 };
export const FOGATA = { x: 0, z: -0.15 };
const AJUSTE_ASIENTO = 0.15;   // Max se sienta hacia el respaldo (z local)

export function crearCasa(modeloIdolo) {
  const g = new THREE.Group();
  const madera = new THREE.MeshStandardMaterial({ color: 0x6a4527, roughness: 0.9 });
  const maderaOscura = new THREE.MeshStandardMaterial({ color: 0x3f2814, roughness: 0.9 });
  const pared = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1, side: THREE.DoubleSide });
  const caja = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // habitacion: 8 x 7 m, la cama queda en el centro (z de -2.0 a +0.15)
  caja(8, 0.2, 7, madera, 0, -0.1, -0.9);                  // suelo
  caja(8, 3.2, 0.2, pared, 0, 1.6, -4.4);                  // pared del fondo
  caja(8, 3.2, 0.2, pared, 0, 1.6, 2.6);                   // pared de atras
  caja(0.2, 3.2, 7, pared, -4, 1.6, -0.9);                 // pared con ventana
  caja(0.2, 3.2, 7, pared, 4, 1.6, -0.9);
  caja(8, 0.2, 7, maderaOscura, 0, 3.3, -0.9);             // techo
  for (const x of [-2.6, 0, 2.6]) caja(0.25, 0.25, 7, maderaOscura, x, 3.1, -0.9);   // vigas

  // ventana con luz de luna
  caja(0.1, 1.3, 1.8, maderaOscura, -3.88, 1.8, -1.2);
  const luna = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x7f9ad8, toneMapped: false }));
  luna.rotation.y = Math.PI / 2;
  luna.position.set(-3.81, 1.8, -1.2);
  g.add(luna);

  // sillon (mira hacia -z, hacia la fogata): base, cojin del asiento, respaldo, brazos y cojines
  const tela = new THREE.MeshStandardMaterial({ color: 0x8a4332, roughness: 1 });
  const telaClara = new THREE.MeshStandardMaterial({ color: 0xa8573f, roughness: 1 });
  caja(2.2, 0.34, 0.95, maderaOscura, SILLON.x, 0.17, SILLON.z);                      // base
  caja(1.76, 0.16, 0.8, telaClara, SILLON.x, SILLON.altura - 0.08, SILLON.z - 0.02);  // asiento (cara de arriba = SILLON.altura)
  caja(2.2, 0.72, 0.24, tela, SILLON.x, 0.7, SILLON.z + 0.4);                          // respaldo
  for (const lado of [-1, 1]) caja(0.22, 0.4, 0.95, tela, SILLON.x + lado * 1.01, 0.52, SILLON.z - 0.02);   // brazos (bajos: no tapan las piernas de Max)
  caja(0.5, 0.42, 0.14, telaClara, SILLON.x - 0.62, 0.78, SILLON.z + 0.26).rotation.x = -0.18;        // cojines
  caja(0.5, 0.42, 0.14, telaClara, SILLON.x + 0.62, 0.78, SILLON.z + 0.26).rotation.x = -0.18;

  // alfombra bajo el sillon y la fogata, mesa con lampara y repisa con el idolo
  const alfombra = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.02, 40),
    new THREE.MeshStandardMaterial({ color: 0x7a2f2a, roughness: 1 }));
  alfombra.position.set(0, 0.01, 0.6);
  alfombra.receiveShadow = true;
  g.add(alfombra);

  // fogata: anillo de piedras, troncos cruzados, llamas que laten y una luz naranja que parpadea
  const piedra = new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 1, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11 + 0.03 * ((i * 7) % 3), 0), piedra);
    p.position.set(FOGATA.x + Math.cos(a) * 0.5, 0.08, FOGATA.z + Math.sin(a) * 0.5);
    p.rotation.set(i, i * 2, 0);
    p.castShadow = p.receiveShadow = true;
    g.add(p);
  }
  const brasa = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x2a0d05 }));
  brasa.rotation.x = -Math.PI / 2;
  brasa.position.set(FOGATA.x, 0.025, FOGATA.z);
  g.add(brasa);
  const tronco = new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 8), tronco);
    t.rotation.set(Math.PI / 2 - 0.35, 0, 0);
    t.rotation.order = "YXZ";
    t.rotation.y = (i / 4) * Math.PI * 2 + 0.4;
    t.position.set(FOGATA.x, 0.13, FOGATA.z);
    t.castShadow = true;
    g.add(t);
  }
  const texLlama = textura(64, (ctx, s) => {
    const gr = ctx.createRadialGradient(s / 2, s * 0.6, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(255,240,170,1)");
    gr.addColorStop(0.35, "rgba(255,150,40,0.85)");
    gr.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, s, s);
  });
  const llamas = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLlama, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    s.userData = { fase: i * 1.7, vel: 4 + (i % 3) * 1.6, dx: Math.cos(i * 2.1) * 0.12, dz: Math.sin(i * 2.1) * 0.12 };
    s.position.set(FOGATA.x + s.userData.dx, 0.3, FOGATA.z + s.userData.dz);
    llamas.push(s);
    g.add(s);
  }
  const luzFuego = new THREE.PointLight(0xff8a3c, 26, 11, 2);
  luzFuego.position.set(FOGATA.x, 0.75, FOGATA.z);
  g.add(luzFuego);
  g.userData.animar = (t) => {
    for (const s of llamas) {
      const k = 0.85 + Math.sin(t * s.userData.vel + s.userData.fase) * 0.25;
      s.scale.set(0.75 * k, 1.35 * k, 1);
      s.position.y = 0.32 + Math.sin(t * s.userData.vel * 0.7 + s.userData.fase) * 0.06;
    }
    luzFuego.intensity = 26 + Math.sin(t * 11) * 3 + Math.sin(t * 23.7) * 2.2 + Math.sin(t * 4.1) * 2;
  };
  caja(0.9, 0.8, 0.7, madera, 1.8, 0.4, -1.8);
  const pantalla = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false }));
  pantalla.position.set(1.8, 0.95, -1.8);
  g.add(pantalla);
  const lampara = new THREE.PointLight(0xffb468, 14, 9, 2);
  lampara.position.set(1.8, 1.2, -1.8);
  g.add(lampara);
  caja(1.6, 0.08, 0.4, maderaOscura, 3.1, 1.6, -3.3);
  if (modeloIdolo) {
    const idolo = modeloIdolo.clone(true);
    idolo.scale.setScalar(0.9);
    idolo.position.set(3.1, 1.64, -3.3);
    g.add(idolo);
    const brillo = new THREE.PointLight(0xffc040, 3, 4, 2);
    brillo.position.set(3.1, 2.1, -3.0);
    g.add(brillo);
  }

  g.add(new THREE.HemisphereLight(0x8a82a8, 0x4a3224, 1.0));
  return g;
}

// Lugar de la cabaña en el mapa (muy lejos del mundo) y arreglo de la escena final.
export const CASA_POS = new THREE.Vector3(5000, 0, 5000);
let casaFinal = null;
export const animarEscenaFinal = (t) => casaFinal?.userData.animar?.(t);

export async function montarEscenaFinal({ scene, gltfLoader, jugador, axel }) {
  const idolo = await cargarModelo(gltfLoader, "idolo");
  casaFinal = crearCasa(idolo);
  casaFinal.position.copy(CASA_POS);
  scene.add(casaFinal);
  scene.background = new THREE.Color(0x0d1220);
  scene.fog = null;

  // Max sentado en el sillon, de cara a la fogata (hacia -z)
  jugador.pos.set(CASA_POS.x + SILLON.x, 0, CASA_POS.z + SILLON.z);
  axel.grupo.position.set(CASA_POS.x + SILLON.x, 0, CASA_POS.z + SILLON.z + AJUSTE_ASIENTO);   // los pies quedan en el suelo (se anclan solos)
  axel.direccion = Math.PI;
  axel.grupo.rotation.y = Math.PI;
  axel.sentado = true;
  axel.descansando = false;
  axel.grupo.visible = true;
}

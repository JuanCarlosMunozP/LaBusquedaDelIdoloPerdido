// Portal de salida del nivel: columna de luz con aro y el vehículo de regreso (bote, refugio o caravana).
import * as THREE from 'three';
import { altura } from './terreno.js';

// Zona disparadora: main.js revisa la distancia a `portalDatos`. Los vehiculos usan la madera del mundo.
export function crearPortal(scene, animables, matMadera) {
  // ====== PORTAL / BALIZA DE REGRESO (zona disparadora, semana 9)
  // Una columna de luz con aro: en los niveles 1 y 2 vive sobre el altar (lleva al siguiente
  // nivel) y en el ultimo nivel esta en el mar, junto al bote que lleva a casa.
  const matHaz = new THREE.MeshBasicMaterial({
    color: 0x7fd8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false
  });
  const portal = new THREE.Group();
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 40, 24, 1, true), matHaz);
  columna.position.y = 20;
  const aro = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xbff0ff, toneMapped: false }));
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.9;
  const luzPortal = new THREE.PointLight(0x7fd8ff, 25, 18, 2);
  luzPortal.position.y = 2;
  // bote de remos (solo en el nivel del mar): espera en la orilla y el jugador lo rema hasta la baliza
  const bote = new THREE.Group();
  const remos = [];
  {
    const casco = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 3.4), matMadera);
    casco.position.y = 0.1;
    const proa = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.4, 4), matMadera);
    proa.rotation.x = Math.PI / 2;
    proa.rotation.z = Math.PI / 4;
    proa.position.set(0, 0.1, 2.35);
    proa.scale.set(1, 1, 0.6);
    const banco = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.35), matMadera);
    banco.position.y = 0.4;
    bote.add(casco, proa, banco);
    for (const lado of [-1, 1]) {                       // remos: giran sobre el borde del bote al remar
      const pivote = new THREE.Group();
      pivote.position.set(lado * 0.8, 0.55, -0.1);
      const vara = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 6), matMadera);
      vara.rotation.z = Math.PI / 2;
      vara.position.x = lado * 0.8;
      const pala = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.2), matMadera);
      pala.position.x = lado * 1.75;
      pivote.add(vara, pala);
      remos.push(pivote);
      bote.add(pivote);
    }
    bote.traverse((m) => { m.castShadow = true; });
  }
  // refugio de montaña y caravana del desierto
  const refugio = new THREE.Group();
  {
    const paredes = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.4), matMadera);
    paredes.position.y = 0.9;
    const techo = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.9 }));
    techo.rotation.y = Math.PI / 4;
    techo.position.y = 2.4;
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false }));
    puerta.position.set(0, 0.65, 1.22);
    refugio.add(paredes, techo, puerta);
    refugio.position.set(3.2, 0, 0);
  }
  const caravana = new THREE.Group();
  {
    const lona = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 1 });
    const caja = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.6), matMadera);
    caja.position.y = 0.8;
    const toldo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.8, 12, 1, false, 0, Math.PI), lona);
    toldo.rotation.z = Math.PI / 2;
    toldo.rotation.y = Math.PI / 2;
    toldo.position.y = 1.05;
    caravana.add(caja, toldo);
    for (const dx of [-1, 1]) for (const dz of [-0.9, 0.9]) {
      const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), matMadera);
      rueda.rotation.x = Math.PI / 2;
      rueda.position.set(dx, 0.45, dz);
      caravana.add(rueda);
    }
    caravana.position.set(3.4, 0, 0);
  }
  for (const v of [refugio, caravana]) v.traverse((m) => { m.castShadow = true; });
  portal.add(columna, aro, luzPortal, bote, refugio, caravana);
  portal.visible = false;
  scene.add(portal);
  // `bote`: posicion y estado del bote de remos (x, z, yaw; abordo y fase de remada los maneja juego/bote.js)
  const portalDatos = { x: 0, z: 0, radio: 2.4, activo: false, bote: { x: 0, z: 0, yaw: 0, abordo: false, fase: 0, remada: 0 } };
  animables.push((t) => {
    if (!portalDatos.activo) return;
    aro.rotation.z = t * 1.6;
    aro.position.y = 0.9 + Math.sin(t * 2) * 0.12;
    matHaz.opacity = 0.34 + Math.sin(t * 3) * 0.06;
    if (bote.visible) {
      const b = portalDatos.bote;
      const y = -0.05 + Math.sin(t * 1.7) * 0.05;      // el bote cabecea sobre el agua (lo coloca en el mundo, no junto a la baliza)
      bote.position.set(b.x - portal.position.x, y - portal.position.y, b.z - portal.position.z);
      bote.rotation.y = b.yaw;
      bote.rotation.z = Math.sin(t * 1.3) * 0.04;
      portalDatos.bote.y = y;
      remos.forEach((r, i) => { r.rotation.y = (i ? -1 : 1) * Math.sin(b.fase) * 0.5 * b.remada; });   // palean al remar
    }
  });

  // El bote espera en la orilla de la isla, en el agua justo donde acaba la arena, mirando a la baliza.
  function colocarEnLaOrilla(sx, sz) {
    const largo = Math.hypot(sx, sz) || 1, dx = sx / largo, dz = sz / largo;
    let d = 0;
    while (d < largo && altura(dx * d, dz * d) > -0.4) d += 0.5;   // desde el centro de la isla hasta el primer fondo de agua
    const b = portalDatos.bote;
    b.x = dx * d; b.z = dz * d; b.yaw = Math.atan2(dx, dz); b.abordo = false; b.fase = 0; b.remada = 0;
  }

  // coloca la baliza; el bote (si hay) queda en la orilla
  function mostrarPortal(x, z, vehiculo) {
    portalDatos.x = x; portalDatos.z = z; portalDatos.activo = true;
    portal.position.set(x, Math.max(altura(x, z), -0.05), z);
    bote.visible = vehiculo === "bote";
    if (bote.visible) colocarEnLaOrilla(x, z);
    refugio.visible = vehiculo === "refugio";
    caravana.visible = vehiculo === "caravana";
    portal.visible = true;
  }
  function ocultarPortal() {
    portalDatos.activo = false;
    portal.visible = false;
  }

  return { portalDatos, mostrarPortal, ocultarPortal };
}

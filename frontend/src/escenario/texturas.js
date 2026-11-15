// Texturas reales del escenario (public/textures): arena, tierra y agua. Se cargan una sola vez; si alguna
// no llega, el juego usa la textura dibujada de antes y no se rompe.
//   sand.png -> arena      dirt.png -> tierra      water.png -> agua
import * as THREE from 'three';
import { textura } from './utilidades.js';

export const RUTAS_TEXTURAS = {
  arena: "textures/sand.png",
  tierra: "textures/dirt.png",
  agua: "textures/water.png"
};
const METROS_POR_BALDOSA = 4;      // cuanto suelo cubre una repeticion de la textura

let pendiente = null;

// Carga (una vez) las tres texturas. Cada una es null si fallo la descarga.
export function cargarTexturas(cargador = new THREE.TextureLoader(), base = import.meta.env?.BASE_URL ?? "/") {
  pendiente ??= Promise.all(Object.entries(RUTAS_TEXTURAS).map(async ([clave, ruta]) => {
    try {
      const t = await cargador.loadAsync(base + ruta);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return [clave, t];
    } catch {
      return [clave, null];
    }
  })).then(Object.fromEntries);
  return pendiente;
}

// Cuanto es tierra (1) y cuanto arena (0) en cada punto: la playa es arena y, al subir, se vuelve tierra.
// En el desierto todo es arena.
export function mezclaSuelo(h, tema) {
  if (tema.tipo === "desierto") return 0;
  return THREE.MathUtils.smoothstep(h, 0.3, 1.0);
}

// Pinta el terreno con arena y tierra mezcladas segun la altura. `geometria` ya tiene las alturas puestas.
export function texturarSuelo(geometria, material, texturas, tema, tam) {
  const repetir = tam / METROS_POR_BALDOSA;
  const arena = texturas.arena ?? textura(256, (ctx, t) => {      // respaldo: la textura dibujada de antes
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, t, t);
    for (let i = 0; i < 5000; i++) {
      const g = 150 + Math.random() * 105;
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(Math.random() * t, Math.random() * t, 2, 3);
    }
  });
  arena.repeat.set(repetir, repetir);
  material.map = arena;
  if (!texturas.tierra) return;
  const tierra = texturas.tierra;

  const pos = geometria.attributes.position;
  const mezcla = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) mezcla[i] = mezclaSuelo(pos.getY(i), tema);
  geometria.setAttribute("mezcla", new THREE.BufferAttribute(mezcla, 1));

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tierraMap = { value: tierra };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float mezcla;\nvarying float vMezcla;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMezcla = mezcla;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D tierraMap;\nvarying float vMezcla;")
      .replace("#include <map_fragment>",
        "diffuseColor *= mix(texture2D(map, vMapUv), texture2D(tierraMap, vMapUv), vMezcla);");
  };
}

// Textura del agua en una malla: se repite `veces` y se desliza despacio. Devuelve la funcion (t) para animables.
export function texturarAgua(material, agua, veces) {
  if (!agua) return () => {};
  const t = agua.clone();
  t.needsUpdate = true;
  t.repeat.set(veces, veces);
  material.map = t;
  material.needsUpdate = true;
  return (tiempo) => t.offset.set(tiempo * 0.012, tiempo * 0.008);
}

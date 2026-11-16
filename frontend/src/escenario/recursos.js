// Modelos compartidos entre niveles (palmera e ídolo): se bajan y procesan una sola vez y se reutilizan.
// Antes cada nivel los volvía a pedir al servidor, y en Render (plan gratuito) eso retrasaba el cambio de nivel.
import { VERSION_RECURSOS } from '../juego/version.js';

const RUTAS = {
  palmera: "/textures/palm-tree.glb?v=",
  idolo: "/models/idolo.glb?v="
};
const pendientes = new Map();

// Devuelve la escena original cargada (compartida). Quien la use debe clonarla si va a modificarla por instancia.
export function cargarModelo(gltfLoader, clave) {
  if (!pendientes.has(clave)) {
    const p = gltfLoader.loadAsync(RUTAS[clave] + VERSION_RECURSOS).then((r) => r.scene);
    p.catch(() => pendientes.delete(clave));      // si falla la red, el siguiente nivel lo reintenta
    pendientes.set(clave, p);
  }
  return pendientes.get(clave);
}

// Lanza la descarga en segundo plano (pantalla de inicio) para que el primer nivel y los siguientes no esperen.
export function precargarRecursos(gltfLoader, texturas) {
  for (const clave of Object.keys(RUTAS)) cargarModelo(gltfLoader, clave).catch(() => {});
  texturas?.().catch?.(() => {});
}

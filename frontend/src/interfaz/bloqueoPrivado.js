// Bloqueo del modo incognito / privado: muestra una pantalla "rechazó la conexión" y el juego NO arranca.
// OJO: el servidor no puede saber si una pestana es privada (la peticion HTTP es identica), asi que esto
// es una deteccion en el navegador por heuristica (cuota de almacenamiento en Chrome/Edge y acceso al
// sistema de archivos privado en Firefox). Es un freno ligero: se puede esquivar y puede fallar. Los
// buscadores (Googlebot y similares) nunca se bloquean, para no afectar a la indexacion.
// Se importa PRIMERO en main.js: usa `await` de nivel superior, asi main.js no se ejecuta si se bloquea.

const BUSCADORES = /bot|crawl|spider|slurp|googlebot|bingbot|duckduckbot|baiduspider|yandex|lighthouse|facebookexternalhit/i;

async function esNavegacionPrivada() {
  try {
    if (import.meta.env.DEV || BUSCADORES.test(navigator.userAgent)) return false;
    const almacen = navigator.storage;
    if (!almacen) return false;
    if (almacen.estimate && /Chrome|Chromium|Edg\//.test(navigator.userAgent)) {   // Chrome y Edge: en privado la cuota es pequena
      const { quota } = await almacen.estimate();
      // En Chrome/Edge el modo privado limita la cuota; en uno normal es de decenas de GB (disco).
      // Umbral: el doble del limite de memoria del navegador (el mismo criterio que usa la libreria detectIncognito).
      const limite = (performance.memory?.jsHeapSizeLimit ?? 1073741824) * 2;
      return typeof quota === "number" && quota < limite;
    }
    if (/Firefox/.test(navigator.userAgent) && almacen.getDirectory) {              // Firefox: el sistema de archivos privado falla
      try { await almacen.getDirectory(); return false; } catch { return true; }
    }
  } catch { /* si no se puede comprobar, se deja jugar */ }
  return false;
}

function mostrarBloqueo() {
  const host = location.hostname;
  const capa = document.createElement("div");
  capa.id = "bloqueo-privado";
  capa.setAttribute("role", "alert");
  capa.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff;color:#202124;display:flex;" +
    "align-items:center;justify-content:center;font-family:system-ui,Segoe UI,Arial,sans-serif;padding:24px;box-sizing:border-box";
  const caja = document.createElement("div");
  caja.style.cssText = "max-width:600px;width:100%";
  const titulo = document.createElement("h1");
  titulo.textContent = "No se puede acceder a este sitio web";
  titulo.style.cssText = "font-size:24px;font-weight:500;margin:0 0 16px";
  const detalle = document.createElement("p");
  detalle.textContent = `${host} rechazó la conexión.`;
  detalle.style.cssText = "font-size:15px;margin:0 0 12px;color:#5f6368";
  const codigo = document.createElement("p");
  codigo.textContent = "ERR_CONNECTION_REFUSED";
  codigo.style.cssText = "font-size:12px;margin:0;color:#80868b";
  caja.append(titulo, detalle, codigo);
  capa.appendChild(caja);
  document.body.appendChild(capa);
  document.documentElement.style.overflow = "hidden";
  document.title = host;
}

if (await esNavegacionPrivada()) {
  mostrarBloqueo();
  await new Promise(() => {});      // no resuelve nunca: main.js y el juego no llegan a ejecutarse
}

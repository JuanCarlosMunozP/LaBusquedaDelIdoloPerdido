// Detecta si el navegador esta en una ventana privada (incognito / InPrivate).
//
// OJO: los navegadores esconden esto a proposito, asi que NO es una medida de seguridad fiable:
// es una comprobacion "de buena fe" que puede fallar en ambos sentidos y que quien sepa puede saltarse
// (esta en el cliente). Por eso devuelve `null` cuando no puede estar seguro, y solo se bloquea con
// `true`. La seguridad de verdad (cuentas, sesiones, validacion y limites) esta en el servidor.
//
// Tecnicas (las mismas que usan las librerias de deteccion):
//   - Chrome/Edge/Brave: en privado la cuota de almacenamiento es pequeña (< 2 x el limite del heap de JS)
//   - Firefox: en privado no existe navigator.serviceWorker
//   - Safari y otros: no hay forma fiable -> null
const GIGA = 1024 * 1024 * 1024;

// nav/win se pueden inyectar para probar
export async function detectarModoPrivado({ nav = globalThis.navigator, win = globalThis } = {}) {
  try {
    if (!nav) return { privado: null, metodo: "sin-navegador" };
    const ua = nav.userAgent || "";

    // Firefox
    if (/Firefox\//.test(ua) && !/Seamonkey/.test(ua)) {
      if (!win.isSecureContext) return { privado: null, metodo: "firefox-no-seguro" };
      return { privado: !nav.serviceWorker, metodo: "firefox-serviceworker" };
    }

    // Safari (no es Chromium): no se puede saber
    const esChromium = /Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua);
    if (!esChromium) return { privado: null, metodo: "navegador-sin-metodo" };

    // Chrome, Edge, Brave, Opera
    if (!nav.storage?.estimate) return { privado: null, metodo: "sin-storage-estimate" };
    const { quota } = await nav.storage.estimate();
    if (!Number.isFinite(quota) || quota <= 0) return { privado: null, metodo: "cuota-invalida" };
    const heap = win.performance?.memory?.jsHeapSizeLimit;
    const limite = (Number.isFinite(heap) && heap > 0 ? heap : GIGA) * 2;
    return { privado: quota < limite, metodo: "chromium-cuota" };
  } catch {
    return { privado: null, metodo: "error" };
  }
}

// Solo se bloquea con certeza de que es privado (nunca por duda)
export const debeBloquear = (resultado) => resultado?.privado === true;

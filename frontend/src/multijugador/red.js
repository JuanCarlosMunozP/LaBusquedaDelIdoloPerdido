// Conexion WebSocket con la sala. El servidor valida todo; aqui solo se envia lo propio (limitado a ~10 veces
// por segundo) y se entregan los mensajes del servidor a quien los dibuje.

// ws:// o wss:// segun la pagina (en Render y en el VPS va por https -> wss)
export function urlSala(loc, codigo) {
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/api/v1/ws/rooms/${encodeURIComponent(codigo)}`;
}

// Un codigo valido: 5 letras/numeros (sin 0, O, 1, I, L). Devuelve el codigo en mayusculas o null.
export function normalizarCodigo(texto) {
  const c = String(texto ?? "").trim().toUpperCase();
  return /^[A-HJKMNP-Z2-9]{5}$/.test(c) ? c : null;
}

// alMensaje(msg) recibe cada objeto {t: "sala"|"entra"|"estado"|"sale"|"corregir"|"error"}; alCerrar(codigo) al caerse
export function crearRed({ url, alMensaje, alCerrar = () => {}, crearSocket = (u) => new WebSocket(u), reloj = () => performance.now(), intervaloMs = 100 }) {
  let socket = null;
  let ultimoEnvio = -Infinity;

  return {
    get abierta() { return socket?.readyState === 1; },

    conectar() {
      socket = crearSocket(url);
      socket.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg && typeof msg === "object" && typeof msg.t === "string") alMensaje(msg);
      };
      socket.onclose = (e) => { socket = null; alCerrar(e?.code); };
      socket.onerror = () => {};       // el cierre llega justo despues por onclose
    },

    // Envia el estado propio, pero no mas seguido que intervaloMs. Devuelve true si salio.
    enviarEstado(estado) {
      if (socket?.readyState !== 1) return false;
      const ahora = reloj();
      if (ahora - ultimoEnvio < intervaloMs) return false;
      ultimoEnvio = ahora;
      socket.send(JSON.stringify({ t: "estado", ...estado }));
      return true;
    },

    cerrar() {
      const s = socket;
      socket = null;
      if (s) { s.onclose = null; try { s.close(); } catch { /* ya estaba cerrado */ } }
    }
  };
}

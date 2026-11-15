// Ventana que aparece al pulsar "Jugar": un jugador o multijugador. Si el navegador esta en modo
// privado, en vez de las opciones muestra el aviso de bloqueo (ver seguridad/modoPrivado.js).
import { detectarModoPrivado, debeBloquear } from '../seguridad/modoPrivado.js';

// Que se muestra segun el estado (puro, para poder probarlo sin DOM)
export function modeloModal({ privado, multijugador }) {
  if (privado) {
    return {
      bloqueado: true,
      titulo: "Ventana privada detectada",
      texto: "Para jugar, abre el juego en una ventana normal del navegador (no incógnito ni InPrivate). " +
        "Así se guardan tu progreso, tu inventario y tus partidas con amigos.",
      opciones: []
    };
  }
  return {
    bloqueado: false,
    titulo: "¿Cómo quieres jugar?",
    texto: "",
    opciones: [
      { id: "solo", etiqueta: "Un jugador", detalle: "Explora la isla por tu cuenta.", activa: true },
      { id: "multi", etiqueta: "Multijugador", detalle: multijugador ? "Juega en tiempo real con tus amigos." : "Muy pronto: juega con tus amigos.", activa: !!multijugador }
    ]
  };
}

const resultadoPrivado = detectarModoPrivado();      // se calcula una sola vez, al cargar la pagina

// Muestra la ventana y devuelve "solo" | "multi" | null (si la cierran o esta bloqueado).
export async function pedirModo({ multijugador = false } = {}) {
  if (document.getElementById("modal-modo")) return null;     // ya hay una abierta (doble clic)
  const privado = debeBloquear(await resultadoPrivado);
  const m = modeloModal({ privado, multijugador });
  return new Promise((resolver) => {
    const fondo = document.createElement("div");
    fondo.id = "modal-modo";
    fondo.setAttribute("role", "dialog");
    fondo.setAttribute("aria-modal", "true");
    fondo.setAttribute("aria-label", m.titulo);
    const caja = document.createElement("div");
    caja.className = "modal-caja";
    const h = document.createElement("h2");
    h.textContent = m.titulo;
    caja.append(h);
    if (m.texto) {
      const p = document.createElement("p");
      p.textContent = m.texto;
      caja.append(p);
    }
    const cerrar = (valor) => {
      document.removeEventListener("keydown", alTeclear, true);
      fondo.remove();
      resolver(valor);
    };
    for (const o of m.opciones) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "modal-opcion";
      b.disabled = !o.activa;
      const t = document.createElement("strong");
      t.textContent = o.etiqueta;
      const d = document.createElement("span");
      d.textContent = o.detalle;
      b.append(t, d);
      b.addEventListener("click", () => cerrar(o.id));
      caja.append(b);
    }
    const volver = document.createElement("button");
    volver.type = "button";
    volver.className = "modal-volver";
    volver.textContent = m.bloqueado ? "Entendido" : "Cancelar";
    volver.addEventListener("click", () => cerrar(null));
    caja.append(volver);
    const alTeclear = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(null); } };
    document.addEventListener("keydown", alTeclear, true);
    fondo.append(caja);
    document.body.append(fondo);
    (caja.querySelector("button:not([disabled])") ?? volver).focus();
  });
}

// Panel del inventario (tecla E). Solo dibuja y avisa que boton se pulso; la logica esta en
// juego/inventario.js y main.js decide que hacer. Mientras esta abierto el juego queda en pausa.
//   acciones = { sombrero(), guardarArma(), cambiarArma(indice), cerrar() }
import { MAX_MOCHILA } from '../juego/inventario.js';

const el = (etiqueta, props = {}, hijos = []) => {
  const e = Object.assign(document.createElement(etiqueta), props);
  e.append(...hijos);
  return e;
};

const textoArma = (arma, municion) => (arma.tipo === "pistola" ? `${arma.id} · ${municion} balas` : arma.id);

export function crearPanelInventario(inventario, jugador, acciones) {
  const raiz = el("div", { id: "inventario", className: "oculta" });
  raiz.setAttribute("role", "dialog");
  raiz.setAttribute("aria-label", "Inventario");
  const caja = el("div", { className: "inv-caja" });
  raiz.append(caja);
  document.body.appendChild(raiz);

  // clic fuera de la caja cierra (los botones dentro no propagan)
  raiz.addEventListener("pointerdown", (e) => { if (e.target === raiz) acciones.cerrar(); });

  function boton(texto, alPulsar, { desactivado = false, tecla = "" } = {}) {
    const b = el("button", { type: "button", className: "inv-boton", disabled: desactivado });
    b.append(el("span", { textContent: texto }));
    if (tecla) b.append(el("kbd", { textContent: tecla }));
    b.addEventListener("click", alPulsar);
    return b;
  }

  // `tieneSombrero`: ya lo recupero (antes de la cinematica del avion lo lleva en la mano y no se puede guardar)
  function pintar({ tieneSombrero, sombreroPermitido }) {
    caja.replaceChildren();
    caja.append(el("h2", { textContent: "Inventario" }));

    // ---- sombrero
    const puesto = inventario.sombrero === "puesto";
    const fila = el("section", { className: "inv-seccion" }, [el("h3", { textContent: "Sombrero" })]);
    if (!tieneSombrero) {
      fila.append(el("p", { className: "inv-nota", textContent: "Aún lo llevas en la mano." }));
    } else {
      fila.append(
        el("p", { className: "inv-nota", textContent: puesto ? "Puesto en la cabeza." : "Guardado en la mochila." }),
        boton(puesto ? "Quitarse y guardar el sombrero" : "Ponerse el sombrero", acciones.sombrero, { tecla: "H" })
      );
      if (!sombreroPermitido) fila.append(el("p", { className: "inv-nota", textContent: "Aquí no se usa: se verá al salir." }));
    }
    caja.append(fila);

    // ---- arma en la mano
    const mano = el("section", { className: "inv-seccion" }, [el("h3", { textContent: "En la mano" })]);
    mano.append(el("p", { className: "inv-nota", textContent: jugador.arma ? textoArma(jugador.arma, jugador.municion) : "Puños" }));
    if (jugador.arma) {
      mano.append(boton("Guardar el arma", acciones.guardarArma, { desactivado: inventario.mochila.length >= MAX_MOCHILA, tecla: "G" }));
    }
    caja.append(mano);

    // ---- mochila
    const mochila = el("section", { className: "inv-seccion" }, [el("h3", { textContent: `Mochila (${inventario.mochila.length}/${MAX_MOCHILA})` })]);
    if (!inventario.mochila.length) {
      mochila.append(el("p", { className: "inv-nota", textContent: "Vacía. Recoge kits de arma para guardar más." }));
    }
    inventario.mochila.forEach((it, i) => {
      mochila.append(boton(`${jugador.arma ? "Cambiar por" : "Sacar"} ${textoArma(it.arma, it.municion)}`, () => acciones.cambiarArma(i), { tecla: String(i + 1) }));
    });
    caja.append(mochila);

    caja.append(boton("Cerrar", acciones.cerrar, { tecla: "E" }));
  }

  return {
    get abierto() { return !raiz.classList.contains("oculta"); },
    abrir(datos) { pintar(datos); raiz.classList.remove("oculta"); caja.querySelector("button:not([disabled])")?.focus(); },
    actualizar(datos) { pintar(datos); },
    cerrar() { raiz.classList.add("oculta"); }
  };
}

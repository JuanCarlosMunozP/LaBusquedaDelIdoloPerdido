// Ventana del multijugador: crear una sala nueva o entrar a una con su codigo. Solo con cuenta (sin invitados).
import { crearSalaEnServidor } from '../cuenta/apiCliente.js';
import { normalizarCodigo } from '../multijugador/red.js';

// Que se muestra (puro, para probarlo sin DOM)
export function modeloSala({ conCuenta }) {
  if (!conCuenta) {
    return {
      titulo: "Necesitas una cuenta",
      texto: "El multijugador es solo para jugadores con cuenta. Inicia sesión (o crea una cuenta) y vuelve a pulsar Jugar.",
      puedeJugar: false
    };
  }
  return { titulo: "Multijugador", texto: "Crea una sala y comparte el código, o entra a la de un amigo (hasta 4 jugadores).", puedeJugar: true };
}

function boton(texto, clase, alPulsar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = clase;
  b.textContent = texto;
  b.addEventListener("click", alPulsar);
  return b;
}

// Devuelve el codigo de la sala a la que entrar, o null si cancelan
export function pedirSala({ conCuenta }) {
  if (document.getElementById("modal-modo")) return Promise.resolve(null);
  const m = modeloSala({ conCuenta });
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
    const p = document.createElement("p");
    p.textContent = m.texto;
    caja.append(h, p);

    const cerrar = (valor) => { document.removeEventListener("keydown", alTeclear, true); fondo.remove(); resolver(valor); };
    const alTeclear = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(null); } };
    const aviso = document.createElement("p");
    aviso.setAttribute("role", "status");

    if (m.puedeJugar) {
      const crear = boton("Crear sala", "modal-opcion", async () => {
        crear.disabled = true;
        aviso.textContent = "Creando sala…";
        const r = await crearSalaEnServidor();
        if (r.ok && r.datos?.codigo) cerrar(r.datos.codigo);
        else { crear.disabled = false; aviso.textContent = "No se pudo crear la sala. Intenta de nuevo."; }
      });
      const entrada = document.createElement("input");
      entrada.type = "text";
      entrada.maxLength = 5;
      entrada.placeholder = "Código de sala";
      entrada.autocomplete = "off";
      entrada.setAttribute("aria-label", "Código de sala");
      entrada.className = "modal-codigo";
      const unirse = boton("Unirse", "modal-opcion", () => {
        const codigo = normalizarCodigo(entrada.value);
        if (codigo) cerrar(codigo);
        else aviso.textContent = "El código tiene 5 letras o números.";
      });
      entrada.addEventListener("keydown", (e) => { if (e.key === "Enter") unirse.click(); e.stopPropagation(); });
      caja.append(crear, entrada, unirse);
    }
    caja.append(aviso, boton(m.puedeJugar ? "Cancelar" : "Entendido", "modal-volver", () => cerrar(null)));
    document.addEventListener("keydown", alTeclear, true);
    fondo.append(caja);
    document.body.append(fondo);
    (caja.querySelector("button:not([disabled])") ?? caja).focus();
  });
}

// Tutorial de controles: aparece solo dentro del primer nivel (nunca en la portada ni tras el login).
// Pide las teclas de una en una y en orden: cada instruccion aparece cuando se cumple la anterior, y
// al terminar la ultima desaparece. No se muestra en pantallas tactiles (alli se usan los botones en
// pantalla) y, una vez completado u omitido, no vuelve a salir.
import { dispositivo } from "./dispositivo.js";

const PASOS = [
  { teclas: ["w"], etiqueta: "W", texto: "para ir hacia adelante" },
  { teclas: ["s"], etiqueta: "S", texto: "para ir hacia atrás" },
  { teclas: ["d"], etiqueta: "D", texto: "para ir a la derecha" },
  { teclas: ["a"], etiqueta: "A", texto: "para ir a la izquierda" },
  { teclas: [" "], etiqueta: "Barra espaciadora", texto: "para saltar" },
  { teclas: ["f", "j"], etiqueta: "F", texto: "para golpear (con puños alterna ambos brazos y patadas)" },
  { teclas: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], etiqueta: "1 a 9", texto: "para cambiar de arma" },
  { teclas: ["e"], etiqueta: "E", texto: "para abrir el inventario (pulsa E otra vez para cerrarlo)" },
];
const CLAVE = "tutorialControlesVisto";
const PAUSA_ENTRE_PASOS = 700;            // ms que se ve el "✓" antes de pasar a la siguiente instruccion
const leer = () => { try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; } };
const guardar = () => { try { localStorage.setItem(CLAVE, "1"); } catch { /* sin almacenamiento: se mostrara otra vez */ } };

export function iniciarTutorial(estado, nivel) {
  if (dispositivo.tactil || leer()) return;
  const titulo = document.createElement("p");
  titulo.className = "tutorial-titulo";
  const paso = document.createElement("p");
  paso.className = "tutorial-paso";
  const omitir = document.createElement("p");
  omitir.className = "tutorial-omitir";
  omitir.textContent = "Enter para omitir";
  const caja = document.createElement("div");
  caja.id = "tutorial";
  caja.setAttribute("role", "status");
  caja.hidden = true;
  caja.append(titulo, paso, omitir);
  document.body.appendChild(caja);

  let actual = 0, empezado = false, esperando = false;
  const pintar = (hecho = false) => {
    const p = PASOS[actual];
    titulo.textContent = `Controles (${actual + 1}/${PASOS.length})`;
    paso.replaceChildren();
    const tecla = document.createElement("b");
    tecla.textContent = p.etiqueta;
    paso.append(hecho ? "✓ " : "Presiona ", tecla, ` ${p.texto}`);
    paso.classList.toggle("hecho", hecho);
  };
  const cerrar = (mensaje) => {
    clearInterval(reloj);
    window.removeEventListener("keydown", alPulsar);
    guardar();
    if (!mensaje) { caja.remove(); return; }
    titulo.textContent = mensaje;
    paso.hidden = omitir.hidden = true;
    setTimeout(() => caja.remove(), 1800);
  };
  const alPulsar = (e) => {
    if (!empezado || e.repeat || esperando) return;
    const k = e.key.toLowerCase();
    if (k === "enter") { cerrar(); return; }
    if (!PASOS[actual].teclas.includes(k)) return;
    esperando = true;
    pintar(true);                                   // se ve el visto bueno y luego aparece la siguiente
    setTimeout(() => {
      esperando = false;
      if (++actual >= PASOS.length) cerrar("¡Listo! Ahora sigue con la misión.");
      else pintar();
    }, PAUSA_ENTRE_PASOS);
  };
  // Solo cuenta y se ve mientras se juega el primer nivel (no en cinematicas, pausa ni menus).
  const reloj = setInterval(() => {
    const e = estado();
    if (!empezado && e === "jugando" && nivel() === 0) { empezado = true; pintar(); }
    caja.hidden = !(empezado && (e === "jugando" || e === "inventario"));
  }, 200);
  window.addEventListener("keydown", alPulsar);
}

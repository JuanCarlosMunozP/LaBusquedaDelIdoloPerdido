// Tutorial de controles: aparece solo dentro del primer nivel (nunca en la portada ni tras el login),
// pide cada tecla una vez y desaparece al completarlas todas. No se muestra en pantallas tactiles
// (alli se usan los botones en pantalla) y, una vez completado u omitido, no vuelve a salir.
import { dispositivo } from "./dispositivo.js";

const PASOS = [
  { teclas: ["w"], etiqueta: "W", texto: "Adelante" },
  { teclas: ["s"], etiqueta: "S", texto: "Atrás" },
  { teclas: ["d"], etiqueta: "D", texto: "A la derecha" },
  { teclas: ["a"], etiqueta: "A", texto: "A la izquierda" },
  { teclas: [" "], etiqueta: "Barra espaciadora", texto: "Saltar" },
  { teclas: ["f", "j"], etiqueta: "F", texto: "Golpear" },
  { teclas: ["e"], etiqueta: "E", texto: "Abrir el inventario (vuelve a pulsar E para cerrarlo)" },
];
const CLAVE = "tutorialControlesVisto";
const leer = () => { try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; } };
const guardar = () => { try { localStorage.setItem(CLAVE, "1"); } catch { /* sin almacenamiento: se mostrara otra vez */ } };

export function iniciarTutorial(estado, nivel) {
  if (dispositivo.tactil || leer()) return;
  const hechos = new Set();
  const filas = PASOS.map((p) => {
    const fila = document.createElement("li");
    const tecla = document.createElement("b");
    tecla.textContent = p.etiqueta;
    fila.append(tecla, ` — ${p.texto}`);
    return fila;
  });
  const titulo = document.createElement("p");
  titulo.className = "tutorial-titulo";
  titulo.textContent = "Controles: presiona cada tecla";
  const omitir = document.createElement("p");
  omitir.className = "tutorial-omitir";
  omitir.textContent = "Enter para omitir";
  const caja = document.createElement("div");
  caja.id = "tutorial";
  caja.setAttribute("role", "status");
  caja.hidden = true;
  const lista = document.createElement("ul");
  lista.append(...filas);
  caja.append(titulo, lista, omitir);
  document.body.appendChild(caja);

  let empezado = false;
  const terminar = () => {
    clearInterval(reloj);
    window.removeEventListener("keydown", alPulsar);
    guardar();
    caja.classList.add("listo");
    caja.hidden = false;
    titulo.textContent = "¡Listo! Ahora sigue con la misión.";
    setTimeout(() => caja.remove(), 1800);
  };
  const alPulsar = (e) => {
    if (!empezado || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "enter") { caja.remove(); clearInterval(reloj); window.removeEventListener("keydown", alPulsar); guardar(); return; }
    PASOS.forEach((p, i) => {
      if (!p.teclas.includes(k) || hechos.has(i)) return;
      hechos.add(i);
      filas[i].classList.add("hecho");
    });
    if (hechos.size === PASOS.length) terminar();
  };
  // Solo cuenta y se ve mientras se juega el primer nivel (no en cinematicas, pausa ni menus).
  const reloj = setInterval(() => {
    const e = estado();
    if (!empezado && e === "jugando" && nivel() === 0) empezado = true;
    caja.hidden = !(empezado && (e === "jugando" || e === "inventario"));
  }, 200);
  window.addEventListener("keydown", alPulsar);
}

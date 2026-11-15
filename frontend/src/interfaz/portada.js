// Primer clic de la portada ("Iniciar sesión"): abre el login y, al terminar, sigue directo hacia
// el juego (se pulsa "Jugar" solo). Si algo falla vuelve a ofrecer "Iniciar sesión".
// Devuelve true si el clic era de esta fase (el que llama no debe seguir con "Jugar").
import { hud } from "./hud.js";
import { NIVELES } from "../juego/datos.js";

// Despues del login la portada deja de mostrar la descripcion general y la clasificacion/apoyo:
// en su lugar describe el nivel que se va a jugar.
function describirNivel(n) {
  for (const id of ["clasificacion", "apoyo"]) document.getElementById(id)?.setAttribute("hidden", "");
  hud.texto.textContent = NIVELES[n]?.descripcion ?? "";
}

let sesionLista = false;
export function iniciarDesdePortada({ boton, entrar, poner, nivel }) {
  if (sesionLista) return false;
  poner("cargando");
  boton.disabled = true;
  boton.textContent = "Cargando…";
  entrar().then(() => {
    sesionLista = true;
    describirNivel(nivel());
    poner("inicio");
    boton.disabled = false;
    boton.textContent = "Jugar";
    boton.click();
  }).catch((err) => {
    console.error(err);
    poner("inicio");
    boton.disabled = false;
    boton.textContent = "Iniciar sesión";
  });
  return true;
}

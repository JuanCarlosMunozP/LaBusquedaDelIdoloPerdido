// Inventario en partida (tecla E): abrir, cerrar y atender sus teclas; el juego queda en pausa mientras esta abierto.
import { crearPanelInventario } from '../interfaz/panelInventario.js';
import { g, jugador, cinematicasVistas } from './estadoJuego.js';
import { bloquearRaton } from './escena.js';
import { sonido, inventario, suministros } from './servicios.js';

// ---- inventario (tecla T): el juego queda en pausa mientras esta abierto
const datosInventario = () => ({
  tieneSombrero: g.nivel > 0 || cinematicasVistas.has(0),
  sombreroPermitido: g.mundo.tema.sombrero !== false
});
const accionesInventario = {
  sombrero: () => { inventario.alternarSombrero(); sonido.equipar(); panelInventario.actualizar(datosInventario()); },
  guardarArma: () => {
    if (inventario.guardarEnMano(jugador)) { suministros.sincronizarArma(g.axel); sonido.equipar(); }
    panelInventario.actualizar(datosInventario());
  },
  cambiarArma: (i) => {
    if (inventario.cambiarArma(jugador, i)) { suministros.sincronizarArma(g.axel); sonido.equipar(); }
    panelInventario.actualizar(datosInventario());
  },
  cerrar: () => cerrarInventario()
};
const panelInventario = crearPanelInventario(inventario, jugador, accionesInventario);

export function abrirInventario() {
  if (g.estado !== "jugando" || !jugador.vivo || g.dialogo || g.cambiandoNivel || !g.axel) return;
  g.estado = "inventario";                  // antes de soltar el raton, para que no se tome como una pausa
  document.exitPointerLock?.();
  panelInventario.abrir(datosInventario());
}

export function cerrarInventario() {
  if (g.estado !== "inventario") return;
  panelInventario.cerrar();
  g.estado = "jugando";
  bloquearRaton();                        // si el navegador lo impide, un clic lo recupera
}

export function teclaInventario(k) {
  if (k === "escape") cerrarInventario();
  else if (k === "h") accionesInventario.sombrero();
  else if (k === "g") accionesInventario.guardarArma();
  else if (k >= "1" && k <= "9") accionesInventario.cambiarArma(Number(k) - 1);
}

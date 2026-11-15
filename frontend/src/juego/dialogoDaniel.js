// Dialogo con Daniel (tecla T) y las cinematicas del naufragio que se disparan desde su guion.
import { clone as clonarModelo } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Humano, VESTUARIO_AXEL } from '../personajes/personaje.js';
import { crearCinematicaAvion } from '../escenario/cinematica.js';
import { crearCinematicaPlaya } from '../escenario/cinematicaPlaya.js';
import { decir, cerrarDialogo, mostrarLinea } from '../interfaz/hud.js';
import { GUIONES, CINEMATICAS } from './datos.js';
import { g, jugador, danielPos, cinematicasVistas, cinesHechas } from './estadoJuego.js';
import { scene, camera } from './escena.js';
import { sonido } from './servicios.js';

// Max inconsciente para las cinematicas del naufragio: tendido, flojo y con los ojos cerrados
function crearMaxInconsciente() {
  const max = new Humano(clonarModelo(g.modeloEnemigo));
  max.personalizarCabelloAxel();
  max.vestir(VESTUARIO_AXEL);
  max.ojosCerrados = true;
  max.tendido = true;
  return max;
}

// ---- dialogo con Daniel (tecla T)
function hablarConDaniel() {
  if (!g.dialogo) {
    const lineas = g.misionesAceptadas
      ? ["Recuerda: cumple todos los objetivos del panel y aparecerá la salida. Yo te espero aquí."]
      : GUIONES[g.nivel];
    g.dialogo = { lineas, i: 0 };
    sonido.recoger();
  } else if (++g.dialogo.i >= g.dialogo.lineas.length) {
    g.dialogo = null;
    cerrarDialogo();
    if (!g.misionesAceptadas) {
      g.misionesAceptadas = true;
      sonido.recoger();
      decir("Misiones recibidas: revisa el panel de la izquierda.", 4);
    }
    return;
  } else if (CINEMATICAS[g.nivel][g.dialogo.i] && !cinesHechas.has(`${g.nivel}:${g.dialogo.i}`)) {
    const tipo = CINEMATICAS[g.nivel][g.dialogo.i];   // cada cinematica se ve una sola vez
    cinesHechas.add(`${g.nivel}:${g.dialogo.i}`);
    if (tipo === "avion") cinematicasVistas.add(g.nivel);
    cerrarDialogo();
    g.estado = "cinematica";
    const opciones = { scene, camera, sonido, crearMax: crearMaxInconsciente };
    g.cine = tipo === "avion" ? crearCinematicaAvion(opciones) : crearCinematicaPlaya(opciones);
    return;
  }
  mostrarLinea(g.dialogo);
}

export function hablarSiEstaCerca() {
  if (g.estado !== "jugando" || !jugador.vivo || !g.daniel) return;
  if (g.dialogo || Math.hypot(jugador.pos.x - danielPos.x, jugador.pos.z - danielPos.z) < 3.6) hablarConDaniel();
}

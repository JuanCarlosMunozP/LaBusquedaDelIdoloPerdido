// Niveles: construir el mundo de cada nivel, precalentar shaders y pasar de nivel por el portal.
import { crearMundo, liberar } from '../escenario/mundo.js';
import { TEMAS } from '../escenario/temas.js';
import { clone as clonarModelo } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Enemigo } from '../personajes/enemigo.js';
import { crearDaniel } from '../personajes/daniel.js';
import { hud, decir, fundido, cerrarDialogo } from '../interfaz/hud.js';
import * as cuenta from '../cuenta/cuenta.js';
import { IDOLOS_POR_NIVEL, NIVELES, CASAS } from './datos.js';
import { g, jugador, obj, enemigos, danielPos, esTerminal, nivelVigente } from './estadoJuego.js';
import { scene, camera, renderer } from './escena.js';
import { sonido, gltfLoader, suministros, frio } from './servicios.js';
import { terminar } from './ciclo.js';

let puedeTeletransportar = true;      // enfriamiento del portal (3 s, como en la clase)

// Cada nivel descarta los objetos del mundo anterior y construye una isla nueva con su tema.
async function cargarMundo(n) {
  const antes = new Set(scene.children);
  const nuevo = await crearMundo(scene, gltfLoader, TEMAS[n]);
  nuevo.objetos = scene.children.filter((o) => !antes.has(o));
  return nuevo;
}

export async function empezarNivel(n) {
  if (!jugador.vivo || (typeof esTerminal === "function" ? esTerminal() : (g.estado === "victoria" || g.estado === "derrota"))) return;
  const req = typeof g.solicitudNivel === "number" ? ++g.solicitudNivel : 1;
  const esVigente = () => typeof nivelVigente === "function"
    ? nivelVigente(req)
    : (jugador.vivo && g.estado !== "victoria" && g.estado !== "derrota");
  g.cambiandoNivel = true;
  const def = NIVELES[n];
  const nuevo = await cargarMundo(n);
  await precalentar();
  if (!esVigente()) {
    if (nuevo?.objetos && typeof liberar === "function") liberar(scene, nuevo.objetos);
    if (typeof g.solicitudNivel !== "number" || req === g.solicitudNivel) g.cambiandoNivel = false;
    return;
  }
  if (nuevo && g.mundo && g.mundo !== nuevo && typeof liberar === "function") liberar(scene, g.mundo.objetos);
  if (nuevo) g.mundo = nuevo;
  g.nivel = n;
  cuenta.guardarNivel(n);
  Object.assign(obj, { idolos: 0, derrotados: 0, fogata: false, altar: false, nado: 0 });
  g.metaLista = false;
  jugador.vida = Math.max(jugador.vida, 60);
  suministros.reiniciar();

  // mercenarios nuevos para este nivel
  for (const e of enemigos) { scene.remove(e.humano.grupo); e.limpiar(); }
  enemigos.length = 0;
  for (const [x, z] of CASAS.slice(0, def.enemigos)) {
    const en = new Enemigo(clonarModelo(g.modeloEnemigo), x, z, g.mundo, scene);
    // mercenarios: chaleco gris y ropa oscura para distinguirlos de Axel
    en.humano.vestir({ vest: 0x5d6168, shirt: 0x1f2226, pants: 0x25282d, boots: 0x15120f });
    enemigos.push(en);
  }
  // Daniel espera junto al punto de inicio
  if (g.daniel) scene.remove(g.daniel.grupo);
  g.daniel = crearDaniel(clonarModelo(g.modeloEnemigo));
  danielPos.set(g.mundo.spawn.x - 3, 0, g.mundo.spawn.z - 2.5);
  danielPos.y = g.mundo.altura(danielPos.x, danielPos.z);
  g.daniel.grupo.position.copy(danielPos);
  scene.add(g.daniel.grupo);
  g.mundo.obstaculos.push({ x: danielPos.x, z: danielPos.z, r: 0.5 });
  g.misionesAceptadas = false;
  g.dialogo = null;
  cerrarDialogo();
  jugador.pos.set(g.mundo.spawn.x, g.mundo.altura(g.mundo.spawn.x, g.mundo.spawn.z), g.mundo.spawn.z);
  jugador.vel.set(0, 0, 0);
  jugador.vy = 0;
  jugador.nadando = false;
  frio.reiniciar(!!g.mundo.tema.frio);
  hud.filaFrio.classList.toggle("oculta", !frio.activo);
  hud.filaCalor.classList.toggle("oculta", !frio.activo);
  document.getElementById("nivel").textContent = `Nivel ${n + 1}/${NIVELES.length}: ${def.nombre}`;
  g.cambiandoNivel = false;
}

// Compila de antemano todos los shaders del nivel, incluso los de lo que aun esta oculto (portal,
// haz del altar...). Sin esto cada uno se compila la primera vez que aparece y el juego se congela
// un instante justo en ese momento. Se hace durante la carga, en paralelo si el navegador puede.
async function precalentar() {
  const ocultos = [];
  scene.traverse((o) => { if (o.visible === false && (o.isMesh || o.isPoints || o.isSprite)) ocultos.push(o); });
  for (const o of ocultos) o.visible = true;
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn("precalentar:", e); }
  for (const o of ocultos) o.visible = false;
}

// Zona disparadora radial: al llegar al bote se pasa al siguiente nivel (o se vuelve a casa)
export function revisarPortal() {
  const p = g.mundo.portal;
  if (!p.activo || !puedeTeletransportar || !jugador.vivo || g.cambiandoNivel) return;
  if (Math.hypot(jugador.pos.x - p.x, jugador.pos.z - p.z) > p.radio) return;
  puedeTeletransportar = false;
  setTimeout(() => (puedeTeletransportar = true), 3000);
  if (g.nivel === NIVELES.length - 1) {
    terminar("victoria");
    return;
  }
  sonido.victoria();
  g.cambiandoNivel = true;
  fundido.style.opacity = 1;
  setTimeout(async () => {
    if (!jugador.vivo || (typeof esTerminal === "function" ? esTerminal() : (g.estado === "victoria" || g.estado === "derrota"))) {
      g.cambiandoNivel = false;
      return;
    }
    const anterior = g.nivel;
    await empezarNivel(anterior + 1);
    if (!jugador.vivo || (typeof esTerminal === "function" ? esTerminal() : (g.estado === "victoria" || g.estado === "derrota")) || g.nivel !== anterior + 1) return;
    decir(`${NIVELES[g.nivel].nombre}: reúne ${IDOLOS_POR_NIVEL} ídolos y cumple los objetivos.`, 6);
    fundido.style.opacity = 0;
  }, 700);
}

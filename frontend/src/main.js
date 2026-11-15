import { clone as clonarModelo } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Humano, VESTUARIO_AXEL } from './personajes/personaje.js';
import { separarEnemigos } from './personajes/enemigo.js';
import { ARMAS } from './personajes/armas.js';
import { cargarReglas } from './juego/reglas.js';
import { gestionarPersonajes } from './juego/detalle.js';
import { pedirModo } from './interfaz/modalModo.js';
import { pedirSala } from './interfaz/modalSala.js';
import { hud, decir, mostrarLinea } from './interfaz/hud.js';
import * as cuenta from './cuenta/cuenta.js';
import { iniciarDesdePortada } from './interfaz/portada.js';
import { iniciarTutorial } from './interfaz/tutorial.js';
import { dispositivo, pantallaCompleta } from './interfaz/dispositivo.js';
import { NIVELES } from './juego/datos.js';
import { g, jugador, enemigos } from './juego/estadoJuego.js';
import { renderer, scene, camera, resolucion, bloquearRaton } from './juego/escena.js';
import { sonido, partida, inventario, suministros, vista, gltfLoader, objetosSueltos } from './juego/servicios.js';
import './juego/controles.js';
import { danar, soltarObjetosDeMax } from './juego/combateJugador.js';
import { empezarNivel } from './juego/niveles.js';
import { actualizarJugador } from './juego/jugadorActualizar.js';

// Punto de entrada: arranque (portada, inicio de sesion y carga) y bucle principal.
// Cada responsabilidad vive en su modulo de juego/ (ver las importaciones de arriba).

let modoElegido = null;                     // "solo" | "multi": se pregunta al pulsar Jugar por primera vez
hud.boton.addEventListener("click", () => {
  if (g.estado === "inicio" && iniciarDesdePortada({ boton: hud.boton, entrar: entrarAlJuego, poner: (e) => (g.estado = e), nivel: () => g.nivel })) return;
  if (g.estado === "inicio" && !modoElegido) {
    pedirModo({ multijugador: true }).then(async (m) => {
      if (m === "multi") g.codigoSala = await pedirSala({ conCuenta: cuenta.inventarioConCuenta() });   // sin cuenta no hay sala
      if (m && (m === "solo" || g.codigoSala)) { modoElegido = m; hud.boton.click(); }
    });
    return;
  }
  if (g.estado === "inicio" || g.estado === "pausa") {
    if (dispositivo.tactil) pantallaCompleta();
    sonido.iniciar();
    g.estado = g.cine ? "cinematica" : "jugando";   // si se pausó en plena cinemática, sigue donde iba
    hud.pantalla.classList.add("oculta");
    hud.ui.classList.remove("oculta");
    bloquearRaton();
    if (g.codigoSala && !partida.activa) partida.conectar(g.codigoSala);
    if (!window.__bienvenida) {
      window.__bienvenida = true;
      decir("Habla con Daniel (T) para recibir tus misiones.", 5);
    }
  } else if (g.estado === "victoria" || g.estado === "derrota") {
    location.reload();
  }
});

const esModoDev = import.meta.env.DEV;
// Con cuenta, el inventario vive en el servidor: se carga al entrar y se guarda cada vez que cambia.
// Invitado o sin conexion: solo el sombrero se recuerda en este navegador.
async function cargarInventarioDeCuenta() {
  if (!cuenta.inventarioConCuenta()) return;
  const guardado = await cuenta.cargarInventario();
  if (!guardado) return;
  inventario.conectar(guardado, ARMAS, cuenta.guardarInventario);
  suministros.sincronizarArma(g.axel);          // muestra en la mano el arma que traia guardada
}

async function entrarAlJuego() {
  await cuenta.sesion();   // login (o invitado) y despues nivel guardado e inventario
  const inicial = esModoDev && /nivel=(\d)/.exec(location.hash);   // #demo&nivel=1 salta a otro bioma (solo en desarrollo)
  await empezarNivel(inicial ? Math.min(+inicial[1], NIVELES.length - 1) : cuenta.nivelGuardado()); await cargarInventarioDeCuenta();
}
async function iniciar() {
  // La misma base de Mixamo conserva las proporciones; cada mercenario recibe rasgos propios.
  const gAxel = await gltfLoader.loadAsync("/models/daniel.glb?v=" + Date.now());
  g.modeloEnemigo = clonarModelo(gAxel.scene);
  g.axel = new Humano(gAxel.scene);
  g.axel.alMorir = soltarObjetosDeMax;
  g.axel.personalizarCabelloAxel();
  // La camisa aporta las mangas de la chaqueta de cuero.
  g.axel.vestir(VESTUARIO_AXEL);
  scene.add(g.axel.grupo);

  g.axel.direccion = Math.PI;
  g.axel.grupo.rotation.y = Math.PI;

  await cargarReglas(ARMAS);                   // tiempos de golpe, daños y suministros los define el servidor
  // Modo de prueba: index.html#demo  o  index.html#demo=x,z (empieza sin pulsar "Jugar")
  if (esModoDev && location.hash.startsWith("#demo")) {
    await entrarAlJuego();
    const [dx, dz, dyaw] = (location.hash.split("=")[1] || "").split(",").map(Number);
    if (!Number.isNaN(dx) && !Number.isNaN(dz)) jugador.pos.set(dx, g.mundo.altura(dx, dz), dz);
    if (!Number.isNaN(dyaw)) vista.yaw = dyaw;   // 3.14 = camara de frente a Axel
    g.estado = "jugando";
    hud.pantalla.classList.add("oculta");
    hud.ui.classList.remove("oculta");
    return;
  }
  iniciarTutorial(() => g.estado, () => g.nivel);
  g.estado = "inicio";
  hud.boton.disabled = false;
  hud.boton.textContent = "Iniciar sesión";
  hud.texto.innerHTML = "<b>Max Montenegro</b> sobrevivió a un naufragio y despierta varado en una isla misteriosa. " +
    "Para volver a casa deberá encontrar el <b>ídolo perdido</b>, escondido entre <b>una isla, una montaña y un desierto</b>, " +
    "y sobrevivir a los mercenarios que lo vigilan.";
}

// ============================================================
// 8. BUCLE PRINCIPAL
// ============================================================
let ultimoCuadro = performance.now();
const humanosEnEscena = [];            // reutilizada cada cuadro (sin crear listas nuevas)

function animar() {
  requestAnimationFrame(animar);
  const ahora = performance.now();
  resolucion.medir(ahora - ultimoCuadro, g.estado === "jugando");
  const dt = Math.min((ahora - ultimoCuadro) / 1000, 0.05);
  ultimoCuadro = ahora;
  g.tiempo += dt;

  g.tactil?.activar(g.estado === "jugando");
  if (g.mundo) {
    if (g.estado === "jugando") {
      g.tiempoFinal += dt;
      actualizarJugador(dt);
      partida.actualizar(dt, g.tiempo, g.nivel);   // manda mi estado y mueve a los demas jugadores
    } else if (g.axel) {
      g.axel.actualizar(dt, 0, true, g.tiempo); // Axel respira en el menu
    }

    if (g.estado === "jugando" || g.estado === "victoria" || g.estado === "derrota") {
      jugador.direccion = g.axel.direccion;   // los enemigos lo necesitan para saber a que lado le pega la bala
      humanosEnEscena.length = 0;           // oculta (y deja de animar) a los que no se ven
      for (const e of enemigos) humanosEnEscena.push(e.humano);
      if (g.daniel) humanosEnEscena.push(g.daniel);
      gestionarPersonajes(camera, humanosEnEscena, jugador.pos);
      if (!g.dialogo && !g.cambiandoNivel) {
        for (const e of enemigos) e.actualizar(dt, g.tiempo, jugador, danar, sonido);
        separarEnemigos(enemigos, jugador, g.mundo);   // no se atraviesan entre si ni a Max
      }
      for (let i = enemigos.length - 1; i >= 0; i--) {
        if (enemigos[i].quitar) {
          scene.remove(enemigos[i].humano.grupo);
          enemigos[i].limpiar();
          enemigos.splice(i, 1);
        }
      }
    }

    if (objetosSueltos.cantidad) {                      // siguen cayendo aunque Max ya este tendido
      const nivelMar = g.mundo.agua?.tipo === "mar" ? g.mundo.agua.nivel : -Infinity;
      objetosSueltos.actualizar(dt, (x, z) => Math.max(g.mundo.altura(x, z), nivelMar));
    }
    if (g.daniel && g.daniel.activo !== false) g.daniel.actualizar(dt, 0, true, g.tiempo);
    g.mundo.actualizar(g.tiempo, dt, jugador.pos);
    const ctx = { estado: g.estado, jugador, mundo: g.mundo, axel: g.axel, tiempo: g.tiempo };
    vista.iluminarRostro(dt, ctx);
    if (!g.cine) vista.actualizar(dt, ctx);
    else if (g.estado !== "pausa" && !g.cine.actualizar(dt)) {   // termino la cinematica: volver al dialogo
      g.cine = null;
      g.estado = "jugando";
      camera.position.copy(jugador.pos);
      mostrarLinea(g.dialogo);
    }
    g.mundo.seguirCamara(camera.position);
  }

  renderer.render(scene, camera);
}

iniciar().catch((err) => {
  console.error(err);
  hud.texto.textContent = "Error al cargar el juego. Revisa la consola (F12).";
});
animar();

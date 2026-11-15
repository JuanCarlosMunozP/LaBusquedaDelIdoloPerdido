// Renderizador, escena y camara. Se ajustan al tamaño visible (en el movil cambia al girar el aparato
// o al ocultarse la barra del navegador).
import * as THREE from 'three';
import { crearResolucionDinamica } from './detalle.js';
import { dispositivo, medidaVisible } from '../interfaz/dispositivo.js';
import { fijarDetalleCabello } from '../personajes/cabello.js';

// Computador: calidad alta. Movil/tableta: media. Raspberry Pi y equipos modestos: baja (ver dispositivo.js)
fijarDetalleCabello(dispositivo.calidad);    // menos triangulos de pelo en movil (ver cabello.js)
export const renderer = new THREE.WebGLRenderer({ antialias: dispositivo.antialias, powerPreference: "high-performance" });
const medida = medidaVisible();
renderer.setSize(medida.ancho, medida.alto);
export const resolucion = crearResolucionDinamica(renderer, { maximo: dispositivo.pixelRatioMax, minimo: dispositivo.pixelRatioMin });   // baja o sube la resolucion segun lo que aguante la tarjeta grafica
renderer.shadowMap.enabled = dispositivo.sombras;
renderer.shadowMap.type = dispositivo.calidad === "baja" ? THREE.BasicShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.domElement.setAttribute("aria-label", "Escena 3D del juego"); (document.querySelector("main") ?? document.body).prepend(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(
  60, medida.ancho / medida.alto, 0.1, 1200);
ajustarCamara();

// Ajusta camara y lienzo al tamaño visible. En el movil cambia al girar el aparato o al ocultarse la
// barra del navegador; en pantallas muy estrechas se ensancha el campo de vision para no ver "por un tubo".
export function ajustarCamara() {
  const { ancho, alto } = medidaVisible();
  camera.aspect = ancho / alto;
  camera.fov = camera.aspect < 1 ? Math.min(85, 60 / Math.max(camera.aspect, 0.6)) : 60;
  camera.updateProjectionMatrix();
  renderer.setSize(ancho, alto);
}
window.addEventListener("resize", ajustarCamara);
window.addEventListener("orientationchange", () => setTimeout(ajustarCamara, 200));
window.visualViewport?.addEventListener("resize", ajustarCamara);

export function bloquearRaton() {
  if (dispositivo.tactil) return;      // sin raton no hay bloqueo del puntero
  const r = renderer.domElement.requestPointerLock?.();
  if (r && r.catch) r.catch(() => {});
}

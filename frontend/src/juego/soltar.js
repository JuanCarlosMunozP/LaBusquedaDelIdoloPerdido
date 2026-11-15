// Objetos que Max suelta al morir (arma y sombrero): salen de la mano o la cabeza con el impulso del
// golpe, caen con gravedad, rebotan un par de veces girando y quedan en el suelo. Solo es visual:
// no cambia el inventario ni la jugabilidad.
import * as THREE from 'three';

const GRAVEDAD = 16;
const REBOTE = 0.38;          // fraccion de velocidad vertical que conserva cada rebote
const ROZAMIENTO = 5;         // frena el deslizamiento por el suelo
const MAX_REBOTES = 3;
const EJE_ARMA = new THREE.Vector3(0, 1, 0);   // las armas se construyen apuntando hacia +Y (ver armas.js)

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Quaternion();
const _eje = new THREE.Vector3(), _dir = new THREE.Vector3();

// Orientacion en la que descansa cada tipo de objeto, partiendo de la actual (conserva el rumbo)
function orientacionReposo(tipo, q, destino) {
  if (tipo === "sombrero") {
    // acostado con la copa hacia arriba: solo se queda el giro alrededor de la vertical
    _dir.set(1, 0, 0).applyQuaternion(q);
    return destino.setFromAxisAngle(_eje.set(0, 1, 0), Math.atan2(-_dir.z, _dir.x));
  }
  // arma: su eje largo queda horizontal, mirando hacia donde apuntaba
  _dir.copy(EJE_ARMA).applyQuaternion(q);
  _dir.y = 0;
  if (_dir.lengthSq() < 1e-4) _dir.set(1, 0, 0);
  _dir.normalize();
  return destino.setFromUnitVectors(EJE_ARMA, _dir);
}

export function crearObjetosSueltos(scene) {
  const lista = [];

  return {
    get cantidad() { return lista.length; },

    // malla: el objeto ya en la escena (en una mano o la cabeza). Conserva su lugar en el mundo.
    //   tipo: "sombrero" | "arma" | grosor: cuanto se eleva sobre el suelo | impulso: {x, z} direccion del golpe
    soltar(malla, { tipo = "arma", grosor = 0.03, impulso = null, fuerza = 1.5 } = {}) {
      if (!malla) return null;
      scene.attach(malla);                // pasa a la escena sin moverse (se conserva la posicion en el mundo)
      malla.visible = true;
      const largo = impulso ? Math.hypot(impulso.x, impulso.z) || 1 : 0;
      const dx = impulso ? impulso.x / largo : 0, dz = impulso ? impulso.z / largo : 0;
      const azar = () => Math.random() * 2 - 1;
      const o = {
        malla, tipo, grosor, rebotes: 0, quieto: false, tiempo: 0,
        vel: new THREE.Vector3(dx * fuerza + azar() * 0.5, 2.2 + Math.random() * 0.8, dz * fuerza + azar() * 0.5),
        giro: new THREE.Vector3(azar() * 9, azar() * 9, azar() * 9)    // rad/s
      };
      lista.push(o);
      return o;
    },

    // suelo: (x, z) => altura donde descansa el objeto (terreno, o el nivel del agua si es mas alto)
    actualizar(dt, suelo) {
      dt = Math.min(dt, 0.05);
      for (const o of lista) {
        if (o.quieto) continue;
        o.tiempo += dt;
        const m = o.malla;
        m.position.x += o.vel.x * dt;
        m.position.z += o.vel.z * dt;
        o.vel.y -= GRAVEDAD * dt;
        m.position.y += o.vel.y * dt;

        // el giro libre se va apagando y el objeto se acuesta de a poco hacia su posicion de reposo
        const amort = Math.exp(-1.5 * dt);
        o.giro.multiplyScalar(amort);
        _e.setFromEuler(new THREE.Euler(o.giro.x * dt, o.giro.y * dt, o.giro.z * dt));
        m.quaternion.premultiply(_e);

        const piso = suelo(m.position.x, m.position.z) + o.grosor;
        if (m.position.y <= piso) {
          m.position.y = piso;
          if (o.vel.y < -1 && o.rebotes < MAX_REBOTES) {
            o.vel.y = -o.vel.y * REBOTE;
            o.vel.x *= 0.6; o.vel.z *= 0.6;
            o.giro.multiplyScalar(0.6);
            o.rebotes++;
          } else {
            o.vel.y = 0;
            const f = Math.exp(-ROZAMIENTO * dt);
            o.vel.x *= f; o.vel.z *= f;
            o.giro.multiplyScalar(Math.exp(-8 * dt));
            orientacionReposo(o.tipo, m.quaternion, _q);
            m.quaternion.slerp(_q, 1 - Math.exp(-9 * dt));
            if (Math.hypot(o.vel.x, o.vel.z) < 0.05 && o.giro.lengthSq() < 0.05 && m.quaternion.angleTo(_q) < 0.02) {
              o.quieto = true;
              m.quaternion.copy(_q);
            }
          }
        }
      }
    },

    limpiar() {
      for (const o of lista) o.malla.removeFromParent();
      lista.length = 0;
    }
  };
}

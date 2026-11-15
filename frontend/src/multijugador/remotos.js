// Los demas jugadores de la sala: un modelo por jugador que sigue suavemente lo que manda el servidor.
// No decide nada (ni vida, ni posiciones): solo dibuja lo que llega.
const DOS_PI = Math.PI * 2;

// Acerca `actual` a `objetivo` sin depender de los cuadros por segundo
export function suavizar(actual, objetivo, dt, k = 12) {
  return actual + (objetivo - actual) * (1 - Math.exp(-k * dt));
}

// Igual con angulos, por el camino corto (de 3.1 a -3.1 gira 0.08, no 6.2)
export function suavizarAngulo(actual, objetivo, dt, k = 12) {
  const dif = ((objetivo - actual + Math.PI) % DOS_PI + DOS_PI) % DOS_PI - Math.PI;
  return actual + dif * (1 - Math.exp(-k * dt));
}

// crearHumano(nombre) -> Humano (con su grupo ya listo para la escena); lo pone el juego
export function crearRemotos({ scene, crearHumano }) {
  const jugadores = new Map();   // id -> { humano, objetivo, x, y, z, ry, visible }

  function aplicar(datos) {
    if (!datos || typeof datos.id !== "string") return;
    let r = jugadores.get(datos.id);
    if (!r) {
      const humano = crearHumano(datos.nombre);
      scene.add(humano.grupo);
      r = { humano, x: datos.x, y: datos.y, z: datos.z, ry: datos.ry };
      jugadores.set(datos.id, r);
    }
    r.objetivo = datos;
  }

  function quitar(id) {
    const r = jugadores.get(id);
    if (!r) return;
    scene.remove(r.humano.grupo);
    jugadores.delete(id);
  }

  function vaciar() {
    for (const id of [...jugadores.keys()]) quitar(id);
  }

  // nivelActual: solo se ven los que estan en el mismo bioma que yo
  function actualizar(dt, tiempo, nivelActual) {
    for (const r of jugadores.values()) {
      const o = r.objetivo;
      r.humano.grupo.visible = r.visible = !!o && o.nivel === nivelActual;
      if (!r.visible) continue;
      const antes = { x: r.x, z: r.z };
      r.x = suavizar(r.x, o.x, dt);
      r.y = suavizar(r.y, o.y, dt);
      r.z = suavizar(r.z, o.z, dt);
      r.ry = suavizarAngulo(r.ry, o.ry, dt);
      const velocidad = dt > 0 ? Math.hypot(r.x - antes.x, r.z - antes.z) / dt : 0;
      r.humano.grupo.position.set(r.x, r.y, r.z);
      r.humano.mirarHacia(r.ry, dt, 40);
      r.humano.actualizar(dt, velocidad, !o.nadando, tiempo, 0, o.nadando ? "mar" : false, o.sombrero ? "cabeza" : "mano");
    }
  }

  return { aplicar, quitar, vaciar, actualizar, get cantidad() { return jugadores.size; }, ids: () => [...jugadores.keys()] };
}

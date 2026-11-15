// Sincroniza los suministros con el servidor. Aqui NO se decide nada del juego: el servidor dice que
// aparece, cuando y cuanto dura (backend/app/domain/supplies.py); este modulo solo guarda esa lista,
// lleva la hora del servidor y pregunta lo justo (cuando toca la proxima aparicion, no cada cuadro).
// Sin Three.js ni DOM, para poder probarlo solo.
//
//   api = { crear(), estado(carrera), reclamar(carrera, item) } -> { ok, datos } | { ok: false, status }
const REINTENTO = 5;        // s: si el servidor no responde, se vuelve a intentar a este ritmo
const MARGEN = 0.25;        // s: se pregunta un instante despues de la hora de la proxima aparicion
const MINIMO = 0.5;         // s: nunca se pregunta mas seguido que esto

export function crearSincronizador({ api, reloj = () => performance.now() / 1000 }) {
  let carrera = null;
  let desfase = 0;           // hora del servidor = reloj local + desfase
  let proximo = 0;           // cuando volver a preguntar (reloj local)
  let ocupado = false;
  let generacion = 0;        // cambia en cada reinicio: las respuestas viejas se ignoran
  const items = new Map();   // id -> suministro tal como lo manda el servidor

  // deja `items` igual a lo que dice el servidor y devuelve que cambio
  function aplicar(estado) {
    desfase = estado.ahora - reloj();
    proximo = reloj() + Math.max(MINIMO, estado.proxima - estado.ahora + MARGEN);
    const vigentes = new Set(estado.items.map((i) => i.id));
    const nuevos = [], quitados = [];
    for (const id of [...items.keys()]) {
      if (!vigentes.has(id)) { items.delete(id); quitados.push(id); }
    }
    for (const it of estado.items) {
      if (!items.has(it.id)) { items.set(it.id, it); nuevos.push(it); }
    }
    return { nuevos, quitados };
  }

  return {
    items,
    get carrera() { return carrera; },

    // hora actual del servidor dentro de la carrera (segundos)
    tiempo() { return reloj() + desfase; },
    edad(item) { return this.tiempo() - item.aparece; },
    vigente(item) { const t = this.tiempo(); return t >= item.aparece && t < item.expira; },
    // los ultimos `aviso` segundos antes de expirar parpadea (el servidor dice cuantos)
    visible(item, aviso) {
      const t = this.tiempo();
      return t < item.expira - aviso || Math.floor(t * 5) % 2 === 0;
    },

    debeSincronizar() { return !ocupado && reloj() >= proximo; },

    // Pregunta al servidor (o abre la carrera la primera vez). Devuelve { nuevos, quitados } o null.
    async sincronizar() {
      if (ocupado) return null;
      ocupado = true;
      const mia = generacion;
      try {
        const r = carrera ? await api.estado(carrera) : await api.crear();
        if (mia !== generacion) return null;                     // hubo un reinicio mientras tanto
        if (!r.ok) {
          proximo = reloj() + (r.status === 404 ? 0 : REINTENTO);   // 404: la carrera ya no existe, abrir otra
          if (r.status === 404) {
            carrera = null;
            const quitados = [...items.keys()];
            items.clear();
            return { nuevos: [], quitados };
          }
          return null;
        }
        carrera = r.datos.carrera;
        return aplicar(r.datos);
      } catch {
        if (mia === generacion) proximo = reloj() + REINTENTO;
        return null;
      } finally {
        if (mia === generacion) ocupado = false;
      }
    },

    // Avisa al servidor que el jugador llego a un suministro.
    // -> { ok: true, recompensa } | { ok: false, perdido: true } (ya no esta) | { ok: false }
    async reclamar(id) {
      if (!carrera) return { ok: false };
      const mia = generacion;
      try {
        const r = await api.reclamar(carrera, id);
        if (mia !== generacion) return { ok: false, perdido: true };
        if (r.ok) { items.delete(id); return { ok: true, recompensa: r.datos }; }
        if (r.status === 404) { items.delete(id); return { ok: false, perdido: true }; }
        return { ok: false };
      } catch {
        return { ok: false };
      }
    },

    // Nueva partida o nivel: se descarta todo y la proxima consulta abre una carrera nueva
    reiniciar() {
      generacion++;
      carrera = null;
      ocupado = false;
      proximo = 0;
      desfase = 0;
      items.clear();
    }
  };
}

// De las posiciones candidatas que manda el servidor ({angulo, fraccion}), la primera que sirva.
// `radioMapa` = hasta donde llega el mapa; `valido(x, z)` -> { y } si el punto sirve, o null.
export function elegirPosicion(candidatos, radioMapa, valido) {
  for (const c of candidatos) {
    const r = 5 + c.fraccion * radioMapa * 0.7;
    const x = Math.cos(c.angulo) * r, z = Math.sin(c.angulo) * r;
    const punto = valido(x, z);
    if (punto) return { x, y: punto.y, z };
  }
  return null;
}

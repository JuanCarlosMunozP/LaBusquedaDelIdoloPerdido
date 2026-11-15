// Version de los recursos pesados (modelos .glb). En produccion es la hora de la compilacion: el
// navegador los guarda en cache y solo los vuelve a bajar cuando se publica una version nueva (antes
// llevaban `Date.now()` y se descargaban ~15 MB completos en cada visita, lo que pesa mucho en el movil).
// En desarrollo se usa la hora actual para ver siempre los cambios.
export const VERSION_RECURSOS = import.meta.env.DEV ? Date.now() : (typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "1");

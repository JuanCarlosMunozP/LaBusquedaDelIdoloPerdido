"""Control de origen para peticiones que modifican datos (POST/PUT/PATCH/DELETE).

Los navegadores mandan siempre `Origin` (y `Sec-Fetch-Site`) en estas peticiones y la pagina no puede
falsearlos. Se rechaza la peticion si viene de otro sitio: `Sec-Fetch-Site: cross-site`, o un `Origin`
cuyo host no es el de esta misma API (ni uno permitido por configuracion). Las peticiones sin ninguna de
las dos cabeceras (curl, pruebas automaticas) no se tocan: ahi mandan la sesion, el CSRF y los limites.

OJO: esto NO impide usar la consola del navegador en la propia pagina (el origen es el mismo) ni detecta
el modo incognito; solo corta ataques desde otros sitios web.
"""
from collections.abc import Mapping
from urllib.parse import urlsplit

from app.core.config import Settings

METODOS_QUE_MODIFICAN = {"POST", "PUT", "PATCH", "DELETE"}
HOSTS_LOCALES = {"localhost", "127.0.0.1", "[::1]"}


def _nombre_de_host(valor: str) -> str:
    """Host sin puerto y en minusculas ('Ejemplo.com:443' -> 'ejemplo.com')."""
    valor = valor.strip().lower()
    if valor.startswith("["):
        return valor.split("]")[0] + "]"
    return valor.split(":")[0]


def origen_permitido(metodo: str, cabeceras: Mapping[str, str], ajustes: Settings) -> bool:
    if not ajustes.origin_check_enabled or metodo.upper() not in METODOS_QUE_MODIFICAN:
        return True
    if cabeceras.get("sec-fetch-site", "").lower() == "cross-site":
        return False
    origen = cabeceras.get("origin")
    if origen is None:
        return True
    if origen == "null":                        # iframes aislados, archivos locales, etc.
        return False
    host_origen = _nombre_de_host(urlsplit(origen).netloc)
    if not host_origen:
        return False
    permitidos = {_nombre_de_host(cabeceras.get("host", "")), *ajustes.allowed_origin_hosts}
    if ajustes.environment.lower() != "production":
        permitidos |= HOSTS_LOCALES             # desarrollo: Vite en localhost hablando con la API local
    return host_origen in permitidos

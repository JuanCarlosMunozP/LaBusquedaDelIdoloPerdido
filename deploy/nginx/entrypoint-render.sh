#!/bin/sh
set -e

# Genera el archivo de Basic Auth a partir de variables de entorno (secrets de Render).
# Falla cerrado: si faltan las credenciales, el sitio NO arranca sin protección.
if [ -z "${BASIC_AUTH_USER}" ] || [ -z "${BASIC_AUTH_PASSWORD}" ]; then
    echo "[nginx-render] ERROR: defina BASIC_AUTH_USER y BASIC_AUTH_PASSWORD." >&2
    exit 1
fi

HASH=$(openssl passwd -apr1 "${BASIC_AUTH_PASSWORD}")
printf '%s:%s\n' "${BASIC_AUTH_USER}" "${HASH}" > /tmp/.htpasswd
chmod 600 /tmp/.htpasswd
echo "[nginx-render] Basic Auth configurado para el usuario ${BASIC_AUTH_USER}."

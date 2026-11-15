#!/bin/bash
# Arranque del contenedor único de Render: migraciones -> FastAPI -> Nginx.
set -euo pipefail

# 1) Render entrega DATABASE_URL como "postgresql://"; el backend usa el driver psycopg 3
if [ -z "${DATABASE_URL:-}" ]; then
    echo "[start] ERROR: DATABASE_URL no está definida." >&2
    exit 1
fi
export DATABASE_URL="${DATABASE_URL/#postgres:\/\//postgresql+psycopg://}"
export DATABASE_URL="${DATABASE_URL/#postgresql:\/\//postgresql+psycopg://}"

# 2) Migraciones y backend (solo en loopback; nunca expuesto directamente)
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers "${UVICORN_WORKERS:-1}" --proxy-headers &
API_PID=$!

# 3) Nginx en primer plano; si cualquiera de los dos muere, el contenedor termina y Render lo reinicia
nginx -c /app/nginx.render.conf -g 'daemon off;' &
NGINX_PID=$!

trap 'kill "$API_PID" "$NGINX_PID" 2>/dev/null || true' TERM INT
wait -n "$API_PID" "$NGINX_PID"
EXIT_CODE=$?
kill "$API_PID" "$NGINX_PID" 2>/dev/null || true
exit "$EXIT_CODE"

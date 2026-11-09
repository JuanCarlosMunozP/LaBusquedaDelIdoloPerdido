#!/bin/sh
# ============================================================================
# PROYECTO: La Búsqueda del Ídolo Perdido — Seguridad Informática
# ARCHIVO:  deploy/network/firewall-default-deny.sh
# SEMANA:   Semana 6 — Cortafuegos, Política Default Deny y Filtrado Multicapa
# USO:      sudo sh deploy/network/firewall-default-deny.sh
# ============================================================================
set -e

echo "[Firewall] Aplicando política por defecto DEFAULT DENY bidireccional en Capa 3/4 (UFW + iptables)..."

# 1. Política por defecto Default Deny para tráfico entrante, saliente y enrutado
ufw --force reset
ufw default deny incoming
ufw default deny outgoing
ufw default deny routed

# 2. Reglas de ENTRADA explícitamente autorizadas:
#    - SSH administrativo con límite de tasa anti-fuerza bruta (22/tcp)
#    - Redirección HTTP hacia HTTPS (80/tcp y 8080/tcp en laboratorio)
#    - Canal seguro TLS 1.2/1.3 (443/tcp y 8443/tcp en laboratorio Raspberry Pi)
ufw limit in 22/tcp comment "Entrada: SSH Administrativo con Rate Limit"
ufw allow in 80/tcp comment "Entrada: Redireccion HTTP 301 a HTTPS"
ufw allow in 443/tcp comment "Entrada: Canal Cifrado HTTPS/TLS Produccion"
ufw allow in 8080/tcp comment "Entrada: Redireccion HTTP Lab Raspberry Pi"
ufw allow in 8443/tcp comment "Entrada: Canal Cifrado HTTPS/TLS Lab Raspberry Pi"

# 3. Reglas de SALIDA explícitamente autorizadas (Menor Privilegio):
#    - Resolución DNS (53/udp y 53/tcp)
#    - Sincronización horaria NTP para validez de certificados TLS y logs (123/udp)
#    - Actualizaciones seguras y validación ACME Let's Encrypt (443/tcp)
#    - Autenticación y contabilidad hacia servidor IAM RADIUS (1812/udp y 1813/udp)
ufw allow out 53/udp comment "Salida: Resolucion DNS UDP"
ufw allow out 53/tcp comment "Salida: Resolucion DNS TCP"
ufw allow out 123/udp comment "Salida: Sincronizacion NTP"
ufw allow out 443/tcp comment "Salida: Tráfico HTTPS autorizado"
ufw allow out 1812/udp comment "Salida: Autenticacion RADIUS"
ufw allow out 1813/udp comment "Salida: Accounting RADIUS"

# 4. Bloqueo explícito de puertos internos de base de datos y aplicación (Defensa en profundidad)
ufw deny in 5432/tcp comment "Bloquear PostgreSQL entrante al host"
ufw deny out 5432/tcp comment "Bloquear PostgreSQL saliente fuera de red interna Docker"
ufw deny in 8000/tcp comment "Bloquear Uvicorn/FastAPI directo al exterior"

# 5. Activar logging y habilitar firewall
ufw logging medium
ufw --force enable

echo "[Firewall] Estado verificado del cortafuegos (Política Default Deny entrante/saliente activa):"
ufw status verbose

# Checklist Maestro de Cumplimiento de Seguridad Informática (Semanas 1 a 10)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Asignatura:** Sistemas de Comunicación y Seguridad Informática
**Rama:** `dev/jesus`

> **Criterio de Honestidad y Trazabilidad Técnica (`AGENTS.md`):**
> Cada control de esta lista indica explícitamente:
> 1. **Evidencia implementada y probada en el repositorio** (código fuente, configuraciones Docker/Nginx/Cisco/Firewall y suites automatizadas `Vitest` / `Pytest`).
> 2. **Procedimiento de validación en vivo** para acreditar su ejecución sobre el entorno objetivo (contenedores Docker / Raspberry Pi / Laboratorio de Red).

---

## 1. Criptografía y Protección de Datos (Semana 1)

- [x] **Protección de Credenciales y Secretos:** Las contraseñas nunca deben almacenarse o procesarse en texto plano; se deben proteger mediante algoritmos de derivación con *Salt* (Argon2id / PBKDF2 con múltiples iteraciones).
  - **Evidencia en Código (`IMPLEMENTADO Y PROBADO`):**
    - [backend/app/core/security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/core/security.py#L14-L74) protege las contraseñas con **Argon2id** (`Type.ID`, `salt_len=16`, `hash_len=32`, `m=64 MiB` en VPS / `32 MiB` en Raspberry Pi, `t=3`, `p=2`) e incluye soporte de derivación `PBKDF2-HMAC-SHA256` con sal aleatoria de 16 bytes (`secrets.token_bytes(16)`) y **`150 000` iteraciones**, comparando siempre en tiempo constante (`hmac.compare_digest`).
    - El frontend ([frontend/src/cuenta/cuenta.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/cuenta.js) y [apiCliente.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/apiCliente.js)) nunca almacena contraseñas ni hashes en el navegador.
  - **Pruebas ejecutadas:** `test_argon2id_password_hashing_and_domain_invariants` ([test_clean_architecture_and_security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/tests/test_clean_architecture_and_security.py#L28-L43)) y `TC-ARCH-004` ([arch-deploy-001.test.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/tests/arch-deploy-001.test.js#L66-L86)).

- [x] **Verificación de Integridad:** Implementación de funciones Hash (`SHA-256` / `HMAC-SHA256`) para certificar que ningún parámetro o archivo sensible haya sido alterado en tránsito o almacenamiento (aprovechando el efecto avalancha).
  - **Evidencia en Código (`IMPLEMENTADO Y PROBADO`):**
    1. **Integridad de parámetros de progreso en BD (`HMAC-SHA256`):** [`sign_progress`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/core/security.py#L101-L111) firma cada registro de `game_progress` sobre el formato canónico `1|username|level|best_time|victories`. Cualquier edición directa en SQL invalida el HMAC por efecto avalancha y restablece el nivel a `1` (`test_db_hmac_tampering_auto_resets_to_level_1`).
    2. **Integridad de tokens de sesión (`SHA-256`):** [`hash_session_token`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/core/security.py#L82-L88) almacena solo el digest `SHA-256` del token opaco en PostgreSQL.
    3. **Integridad de archivos binarios sensibles (`SHA-256`):** Manifiesto criptográfico [deploy/security/sha256-manifest.json](file:///c:/Estudio/Seguridad-Multimedia/deploy/security/sha256-manifest.json) verificado byte a byte con `SHA-256` sobre `frontend/public/models/daniel.glb` y `frontend/public/models/idolo.glb` en `TC-ARCH-006` ([arch-deploy-001.test.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/tests/arch-deploy-001.test.js#L140-L147)) y en [deploy/scripts/auditar-checklist.ps1](file:///c:/Estudio/Seguridad-Multimedia/deploy/scripts/auditar-checklist.ps1#L45-L57).

---

## 2. Seguridad en Transporte e Inspección de Tráfico (Semana 2)

- [x] **Erradicación de Protocolos Inseguros:** Garantizar que el tráfico externo viaje obligatoriamente sobre canales cifrados (`TLS/HTTPS` en puerto `443`/`8443`), eliminando el uso de HTTP plano hacia el cliente.
  - **Evidencia en Configuración (`IMPLEMENTADO`):** [deploy/nginx/nginx.conf](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf#L47-L73) redirige el puerto `80` hacia `https://$host$request_uri` (`HTTP 301`) y sirve el juego y la API `/api/v1` sobre **TLS 1.2 y TLS 1.3** (`ssl_protocols TLSv1.2 TLSv1.3;`) con certificado ECDSA P-256 generado en [entrypoint-tls.sh](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/entrypoint-tls.sh#L1-L21). *(Nota arquitectónica: la comunicación interna entre el contenedor `nginx` y `fastapi:8000` ocurre dentro de la red puente aislada de Docker sin publicar el puerto `8000` al host).*

- [x] **Auditoría de Fuga de Datos:** Verificar mediante capturas de red que las cabeceras y payloads no filtren información crítica ni tokens en texto claro.
  - **Evidencia en Código y Procedimiento de Captura:** Cookies emitidas con `httponly=True`, `secure=True`, `samesite="strict"` en [`_set_auth_cookies`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/routers.py#L39-L59) y guía paso a paso de captura con `tcpdump` / **Wireshark** en el Escenario 3 de [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md#L79-L93).

---

## 3. Segmentación de Red y Perímetro Inalámbrico (Semana 3)

- [x] **Cifrado WiFi Robusto:** Enlace inalámbrico asegurado mediante algoritmos **WPA2/WPA3 Personal o Enterprise** con cifrado **AES (`CCMP`/`GCMP-256`)**.
  - **Evidencia en Repositorio (`PLANTILLA CONFIGURADA Y VERIFICADA`):** Archivo [deploy/network/wpa3-aes-supplicant.conf](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/wpa3-aes-supplicant.conf) con WPA3-SAE (`key_mgmt=SAE WPA-PSK-SHA256`), cifrado `CCMP` (AES) y Protected Management Frames obligatorio (`ieee80211w=2`), más perfil Enterprise `EAP-TLS`.

- [x] **Segmentación Lógica (VLANs y Subredes Docker):** Aislamiento de dominios de difusión en equipamiento de red (**CLI Cisco IOS**) y en redes de contenedores.
  - **Evidencia en Docker (`IMPLEMENTADO Y PROBADO`):** [compose.yaml](file:///c:/Estudio/Seguridad-Multimedia/compose.yaml#L74-L80) aísla `postgres` en `backend_net` (`internal: true`) respecto a `frontend_net` (`TC-ARCH-002`).
  - **Evidencia en Cisco IOS (`PLANTILLA CONFIGURADA Y VERIFICADA`):** Archivo [deploy/network/cisco-ios-vlans-aaa-radius.cfg](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/cisco-ios-vlans-aaa-radius.cfg#L27-L85) con `VLAN 10` (Usuarios/Jugadores con `port-security`), `VLAN 20` (Servidores Críticos), `VLAN 99` (Gestión), `VLAN 666` (Blackhole) y enlace troncal `802.1Q`.

---

## 4. Gestión de Identidades, Accesos y Zero Trust (Semana 4)

- [x] **Modelo AAA Centralizado (IAM):**
  - **En Aplicación (`IMPLEMENTADO Y PROBADO`):** Servicio IAM centralizado en FastAPI (`/api/v1/auth/*` en [routers.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/routers.py#L72-L197)) con bitácora forense en PostgreSQL (`security_audit_logs`).
  - **En Infraestructura de Red (`PLANTILLA CONFIGURADA`):** Servidor RADIUS `IAM_CENTRAL_RADIUS` (`192.168.20.10:1812/1813`) en [cisco-ios-vlans-aaa-radius.cfg](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/cisco-ios-vlans-aaa-radius.cfg#L90-L100).

- [x] **Filosofía Zero Trust y Menor Privilegio:** Separación explícita entre autenticación y autorización (RBAC / Anti-IDOR / CSRF).
  - **Evidencia en Código (`IMPLEMENTADO Y PROBADO`):**
    1. Autenticación por sesión opaca en [`get_current_session`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/dependencies.py#L57-L80).
    2. Autorización Anti-CSRF en [`require_csrf_protection`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/dependencies.py#L83-L107) y aislamiento por usuario autenticado (`session.username`) en `/api/v1/progress`.
    3. Autorización administrativa RBAC (`session.role == "admin"`) en [`require_admin_access`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/dependencies.py#L110-L126) para `/api/v1/security/audit-logs` (`test_user_isolation_and_admin_endpoint_protection`).

- [x] **Mecanismo de Contingencia (Fallback):**
  - **En Red Cisco IOS (`PLANTILLA CONFIGURADA`):** Directivas `aaa authentication login default group radius local` y `aaa authorization exec default group radius local if-authenticated` en [cisco-ios-vlans-aaa-radius.cfg](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/cisco-ios-vlans-aaa-radius.cfg#L102-L109).
  - **En Aplicación (`IMPLEMENTADO Y PROBADO`):** Si el backend no está accesible, [cuenta.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/cuenta.js#L75-L90) informa el estado sin corromper datos y permite jugar explícitamente en modo invitado sin persistencia (`frontend/tests/account-api.test.js`).

---

## 5. Hardening de Servidores Web y Contenedores (Semana 5)

- [x] **Ocultamiento de Banners (`server_tokens off;`):**
  - **Evidencia en Código (`IMPLEMENTADO Y PROBADO`):** Configurado en [deploy/nginx/nginx.conf](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf#L13) (`TC-ARCH-003`).

- [x] **Inyección de Cabeceras HTTP de Seguridad (incluyendo `/models/`):**
  - **Evidencia en Código (`IMPLEMENTADO Y PROBADO`):**
    - Configuradas en el bloque principal `server` ([nginx.conf:78-84](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf#L78-L84)) **y repetidas explícitamente en `location /models/`** ([nginx.conf:116-127](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf#L116-L127)) para que `add_header Cache-Control` no elimine `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` ni `Content-Security-Policy` (`TC-ARCH-003`).
    - Configuradas también en [frontend/vite.config.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/vite.config.js#L5-L27) (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`) y en el middleware de FastAPI ([backend/app/main.py:69-75](file:///c:/Estudio/Seguridad-Multimedia/backend/app/main.py#L69-L75)).

- [x] **Auditoría de Cabeceras (`curl.exe -I`):**
  - **Evidencia:** Automatizada en el paso `[4/4]` de [deploy/scripts/auditar-checklist.ps1](file:///c:/Estudio/Seguridad-Multimedia/deploy/scripts/auditar-checklist.ps1#L67-L84) y documentada en el Escenario 2 de [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md#L58-L77).

---

## 6. Cortafuegos y Network Access Control (Semana 6)

- [x] **Política por Defecto `Default Deny` (Entrante, Saliente y Enrutado):**
  - **Evidencia en Host/Red (`IMPLEMENTADO Y PROBADO`):**
    1. En [deploy/network/firewall-default-deny.sh](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/firewall-default-deny.sh#L14-L44): Aplica `ufw default deny incoming`, **`ufw default deny outgoing`** y `ufw default deny routed`, abriendo únicamente los puertos entrantes (`22`, `80/8080`, `443/8443`) y salientes estrictamente necesarios (`53` DNS, `123` NTP, `443` HTTPS, `1812/1813` RADIUS) (`TC-ARCH-006`).
    2. En [deploy/network/cisco-ios-vlans-aaa-radius.cfg](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/cisco-ios-vlans-aaa-radius.cfg#L118-L141): Define `ip access-list extended ACL_USUARIOS_A_SERVIDORES` (con cierre `deny ip any any log`) **y la aplica activamente mediante `ip access-group ACL_USUARIOS_A_SERVIDORES in` en `interface Vlan10`** (`TC-ARCH-006`).

- [x] **Filtrado Multicapa (Capa 3/4 y Capa 7):**
  - **Capa 3/4:** Subred Docker `backend_net` (`internal: true`), reglas `ufw` bidireccionales y ACL extendida Cisco IOS.
  - **Capa 7:** Bloqueo de archivos ocultos (`location ~ /\. { deny all; }`), `client_max_body_size 64k;`, rate limiting por ruta en Nginx, validación Pydantic (`extra="forbid"`) y extracción segura de IP resistente a spoofing de `X-Forwarded-For` en [`get_client_ip`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/dependencies.py#L29-L48).

---

## 7. DevSecOps y Seguridad Cloud (Semana 7)

- [x] **Integración CI/CD (Shift-Left Security):** Workflow [.github/workflows/devsecops.yml](file:///c:/Estudio/Seguridad-Multimedia/.github/workflows/devsecops.yml#L1-L42) que ejecuta `vitest`, `vite build` y `pytest` en cada `push` y `pull_request`.
- [x] **Análisis Estático y de Dependencias (SAST/SCA con Aqua Trivy):** Escaneo del repositorio (`scan-type: "fs"`, `scanners: "vuln,secret,misconfig"`) y de las imágenes Docker (`idolo-nginx:ci` e `idolo-fastapi:ci`) con `aquasecurity/trivy-action@v0.36.0` ([devsecops.yml:44-91](file:///c:/Estudio/Seguridad-Multimedia/.github/workflows/devsecops.yml#L44-L91)).
- [x] **Mecanismo de Falla Controlada:** Configurado `severity: "CRITICAL,HIGH"` y `exit-code: "1"` en todos los pasos de Trivy (`TC-ARCH-006`). *(La acreditación en vivo se registra automáticamente en la pestaña GitHub Actions al hacer `git push`).*

---

## 8. Auditoría Ofensiva y Pentesting (Semana 8)

- [x] **Reconocimiento y Mapeo de Puertos (`Nmap`):** Procedimiento `nmap -sV -p 80,443,5432,8000,8080,8443 <IP>` en el Escenario 1 de [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md#L44-L56) respaldado por la verificación estática de no exposición de `5432` y `8000` (`TC-ARCH-002`).
- [x] **Escaneo de Vulnerabilidades (`NSE --script vuln` y Pruebas SQLi/XSS):** Comando `nmap -sV --script vuln -p 8080,8443 <IP>` y ataques controlados SQLi/XSS en los Escenarios 1 y 4 de [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md#L48-L111), respaldados por pruebas automatizadas de rechazo de `<script>alert(1)</script>` en [test_clean_architecture_and_security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/tests/test_clean_architecture_and_security.py#L34-L35).

---

## 9. Resiliencia DoS/DDoS y Mitigación Activa (Semanas 9 y 10)

- [x] **Pruebas de Estrés y Carga (`HTTP Flood` con Apache Benchmark `ab`):** Procedimiento `ab -n 200 -c 30 https://<IP>:8443/api/v1/health` y monitoreo `docker stats` en el Escenario 7 de [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md#L156-L176).
- [x] **Bastionado con Limitación de Tasa (`Rate Limiting`):** Configurado `ngx_http_limit_req_module` en [deploy/nginx/nginx.conf](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf#L26-L28) (`auth_limit: 10r/m` con `burst=3 nodelay` y `api_limit: 60r/m` con `burst=15 nodelay`) y segunda capa en [`security_hardening_and_rate_limit_middleware`](file:///c:/Estudio/Seguridad-Multimedia/backend/app/main.py#L40-L65).
- [x] **Preservación de la Disponibilidad:** Configurado `limit_req_status 429;` en Nginx y respuesta `HTTP 429 Too Many Requests` (`Retry-After: 60`) en FastAPI para contener tráfico abusivo mientras se mantiene `HTTP 200 OK` en los activos del juego y usuarios dentro de cuota.

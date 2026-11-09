# Auditoría de Seguridad Informática y Modelo de Amenazas (`SEG-001` a `SEG-008`)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Asignatura:** Sistemas de Comunicación y Seguridad Informática
**Versión:** 1.1
**Rama auditada:** `dev/jesus` (`ce22536` + correcciones de seguridad e infraestructura)
**Alcance:** Evaluación forense real de los controles criptográficos, gestión de identidad (IAM en FastAPI), protección de persistencia en PostgreSQL, superficie DOM/XSS, endurecimiento Nginx/Docker, plantillas de red y postura DevSecOps del repositorio.

---

## 1. Premisa Arquitectónica y Frontera de Confianza

> **Arquitectura Cliente-Servidor Integrada (`ARCH-DEPLOY-001`):** El frontend WebGL ([frontend/src/main.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/main.js) y [frontend/src/cuenta/cuenta.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/cuenta.js)) delega el registro, inicio/cierre de sesión y persistencia del progreso exclusivamente al backend **FastAPI Clean Architecture** ([backend/app/main.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/main.py)) y **PostgreSQL 16** a través de [frontend/src/cuenta/apiCliente.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/apiCliente.js), detrás del gateway TLS **Nginx** ([deploy/nginx/nginx.conf](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf)).

En consecuencia:
1. **Eliminación de secretos en el navegador:** El frontend no almacena contraseñas, hashes, llaves HMAC ni progreso de cuentas en `localStorage` o `sessionStorage`. Si la API `/api/v1` no está disponible, informa el error sin realizar fallback silencioso a almacenamiento local (`frontend/tests/account-api.test.js`, `TC-ARCH-005`).
2. **Separación transparente entre evidencia en código y validación en laboratorio:** Los controles criptográficos, de sesión, CSRF, anti-cheat, anti-spoofing de IP, configuración TLS/cabeceras/rate-limit e integridad `SHA-256` están verificados por pruebas automatizadas locales (`Vitest` y `Pytest`). Las pruebas de red física/equipamiento (VLANs Cisco IOS, WiFi WPA3, servidor RADIUS externo) y las pruebas de carga/escaneo (`Nmap`, `Wireshark`, `Apache Benchmark ab`) cuentan con plantillas y procedimientos reproducibles en [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md) para su ejecución en el entorno de laboratorio.

---

## 2. Evaluación Detallada de los Dominios `SEG-001` a `SEG-008`

### `SEG-001` — Criptografía y Protección de Credenciales
- **Estado:** **`IMPLEMENTADO`** (Verificado en código y pruebas automatizadas)
- **Evidencia en código:** [backend/app/core/security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/core/security.py#L14-L74)
- **Mecanismos verificados:**
  1. **Hashing con Argon2id (`security.py:14-40`):** Utiliza `argon2-cffi` (`Type.ID`, `salt_len=16`, `hash_len=32`, memoria parametrizable `64 MiB` en VPS / `32 MiB` en Raspberry Pi).
  2. **Compatibilidad PBKDF2-HMAC-SHA256 (`security.py:41-72`):** Incluye derivación con sal aleatoria de 16 bytes (`secrets.token_bytes(16)`) y `150 000` iteraciones (`hashlib.pbkdf2_hmac`) verificada en tiempo constante con `hmac.compare_digest`.
  3. **Comparación en tiempo constante (`security.py:91-94`):** `constant_time_equals(a, b)` emplea `hmac.compare_digest` para evitar ataques de temporización (*timing attacks*).
- **Pruebas automatizadas:** `test_argon2id_password_hashing_and_domain_invariants` en [test_clean_architecture_and_security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/tests/test_clean_architecture_and_security.py#L28-L43) y `TC-ARCH-004` en [arch-deploy-001.test.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/tests/arch-deploy-001.test.js#L66-L86).

---

### `SEG-002` — Gestión de Identidad, Autenticación y Sesiones (IAM Backend)
- **Estado:** **`IMPLEMENTADO`** (Verificado en código y pruebas automatizadas)
- **Evidencia en código:** [frontend/src/cuenta/cuenta.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/cuenta.js#L1-L91), [frontend/src/cuenta/apiCliente.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/apiCliente.js#L1-L131), [backend/app/application/use_cases.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/application/use_cases.py), [backend/app/presentation/routers.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/routers.py#L39-L197)
- **Mecanismos verificados:**
  1. **Política de nombres de usuario y contraseñas (`user.py`):** Expresión regular estricta de 3 a 16 caracteres seguros y longitud de contraseña entre 6 y 64 caracteres.
  2. **Bloqueo exponencial por fuerza bruta en servidor (`user.py`, `routers.py:126-131`):** Tras 3 intentos fallidos, bloquea temporalmente la cuenta devolviendo `HTTP 423 Locked` con cabecera `Retry-After`.
  3. **Sesiones opacas y revocables (`security.py:77-88`, `session.py`):** El servidor emite un token CSPRNG de 256 bits en cookie `HttpOnly; Secure; SameSite=Strict` y persiste únicamente su hash `SHA-256` (`token_hash`) en la tabla `user_sessions`. Al cerrar sesión (`/api/v1/auth/logout`), el token se revoca en PostgreSQL inmediatamente.
  4. **Protección CSRF (`dependencies.py:64-88`):** Las operaciones mutantes (`POST /auth/logout`, `PUT /progress`) exigen cabecera `X-CSRF-Token` coincidente en tiempo constante con la sesión activa.
- **Pruebas automatizadas:** [frontend/tests/account-api.test.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/tests/account-api.test.js#L12-L98) y [backend/tests/test_clean_architecture_and_security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/tests/test_clean_architecture_and_security.py#L61-L170).

---

### `SEG-003` — Integridad de Persistencia (`HMAC-SHA256`) y de Archivos Sensibles (`SHA-256`)
- **Estado:** **`IMPLEMENTADO`**
- **Evidencia en código:** [backend/app/core/security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/core/security.py#L97-L111), [deploy/security/sha256-manifest.json](file:///c:/Estudio/Seguridad-Multimedia/deploy/security/sha256-manifest.json)
- **Mecanismos verificados:**
  1. **Firma `HMAC-SHA256` del progreso en PostgreSQL:** Cada fila en `game_progress` se firma sobre el formato canónico `1|username|level|best_time|victories`. Si una fila en SQL es alterada directamente sin recalcular el HMAC, `GetProgressUseCase` lo detecta, restablece el progreso a Nivel 1, emite un evento `DB_TAMPER_RESET` en `security_audit_logs` y notifica al jugador.
  2. **Regla de negocio Anti-Cheat (`progress.py`):** Imposibilidad de saltar del Nivel 1 al Nivel 3 (`TamperDetectedError` → `HTTP 403 Forbidden` + evento `TAMPER_BLOCKED`).
  3. **Certificación `SHA-256` de activos binarios sensibles (`deploy/security/sha256-manifest.json`):** Manifiesto criptográfico `SHA-256` verificado automáticamente sobre `daniel.glb` e `idolo.glb` en `TC-ARCH-006` y en `deploy/scripts/auditar-checklist.ps1`.

---

### `SEG-004` — Seguridad en el Frontend, DOM y Prevención de XSS
- **Estado:** **`PARCIAL / MITIGADO`** (Seguro en toda entrada de usuario; uso acotado de `innerHTML` solo con constantes internas en HUD)
- **Evidencia en código:** [frontend/src/cuenta/pantalla.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/cuenta/pantalla.js#L9-L23), [frontend/src/interfaz/hud.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/src/interfaz/hud.js)
- **Hallazgos:**
  - `pantalla.js` construye todos los nodos de cuenta mediante `document.createElement` y `textContent`; el nombre del jugador nunca se interpola en `innerHTML`.

---

### `SEG-005` — Seguridad de API, Transporte y Anti-Spoofing de IP
- **Estado:** **`IMPLEMENTADO` en configuración y backend (Tráfico interno Docker sobre red aislada)**
- **Evidencia en código:** [deploy/nginx/nginx.conf](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf#L47-L113), [backend/app/presentation/dependencies.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/dependencies.py#L16-L48)
- **Mecanismos verificados:**
  - **Transporte externo TLS 1.2/1.3:** Nginx redirige `HTTP 80 -> HTTPS 443` y termina TLS con certificado ECDSA P-256 ([entrypoint-tls.sh](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/entrypoint-tls.sh)). El tramo interno `nginx -> fastapi:8000` ocurre dentro de la red de contenedores Docker sin exponer el puerto `8000` al host.
  - **Mitigación de suplantación `X-Forwarded-For` (`dependencies.py:16-48` y `nginx.conf:100,111`):** Nginx fija `X-Real-IP $remote_addr` y `X-Forwarded-For $remote_addr`, y `get_client_ip()` solo acepta cabeceras de proxy cuando el par TCP es un proxy privado confiable, tomando `X-Real-IP` o el último salto (`hops[-1]`) para impedir evasión de Rate Limiting.

---

### `SEG-006` — Hardening de Servidor, Contenedores, Red y Cabeceras HTTP
- **Estado:** **`IMPLEMENTADO` en código/configuración (Validación en vivo documentada en Playbook)**
- **Evidencia en repositorio:** [deploy/nginx/nginx.conf](file:///c:/Estudio/Seguridad-Multimedia/deploy/nginx/nginx.conf#L13-L127), [frontend/vite.config.js](file:///c:/Estudio/Seguridad-Multimedia/frontend/vite.config.js#L5-L27), [compose.yaml](file:///c:/Estudio/Seguridad-Multimedia/compose.yaml), [deploy/network/cisco-ios-vlans-aaa-radius.cfg](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/cisco-ios-vlans-aaa-radius.cfg), [deploy/network/firewall-default-deny.sh](file:///c:/Estudio/Seguridad-Multimedia/deploy/network/firewall-default-deny.sh)
- **Mecanismos verificados:**
  - `server_tokens off;`, `limit_req_zone` (`auth_limit` y `api_limit` con `limit_req_status 429;`), cabeceras de seguridad en el bloque `server` **y repetidas explícitamente en `location /models/`** para evitar que `add_header Cache-Control` las suprima.
  - Plantilla Cisco IOS con VLANs (`10`, `20`, `99`, `666`), AAA RADIUS con contingencia local y ACL `ACL_USUARIOS_A_SERVIDORES` aplicada mediante `ip access-group ACL_USUARIOS_A_SERVIDORES in` en `interface Vlan10`.
  - Script de firewall `ufw` con política `Default Deny` bidireccional (`ufw default deny incoming`, `ufw default deny outgoing`, `ufw default deny routed`).

---

### `SEG-007` — Auditoría de Dependencias y Cadena de Suministro (DevSecOps)
- **Estado:** **`IMPLEMENTADO` en repositorio (Ejecución CI en GitHub Actions al hacer push)**
- **Evidencia en repositorio:** [.github/workflows/devsecops.yml](file:///c:/Estudio/Seguridad-Multimedia/.github/workflows/devsecops.yml#L1-L91)
- **Mecanismos verificados:**
  - Ejecución automatizada de `vitest`, `pytest` y escaneo SAST/SCA + imágenes Docker con **Aqua Trivy** (`aquasecurity/trivy-action@0.28.0`, `severity: "CRITICAL,HIGH"`, `exit-code: "1"`).

---

### `SEG-008` — Registro Forense de Eventos (SIEM) y Manejo de Errores
- **Estado:** **`IMPLEMENTADO`**
- **Evidencia en código:** [backend/app/core/security.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/core/security.py#L114-L130), [backend/app/presentation/routers.py](file:///c:/Estudio/Seguridad-Multimedia/backend/app/presentation/routers.py#L248-L271)
- **Mecanismos verificados:**
  - Registro de eventos (`REGISTER_OK`, `LOGIN_OK`, `LOGIN_FAIL_BAD_PASSWORD`, `ACCOUNT_LOCKED`, `TAMPER_BLOCKED`, `DB_TAMPER_RESET`) en `security_audit_logs` y en salida JSON estructurada sin exponer contraseñas ni tokens.

---

## 3. Matriz de Hallazgos y Controles Cerrados

| ID Hallazgo | Categoría STRIDE | Descripción y Ubicación | Estado Actual |
|---|---|---|---|
| **SEC-FIX-01** | *Spoofing / Rate Limit Bypass* | `backend/app/presentation/dependencies.py:16-48` y `deploy/nginx/nginx.conf:100,111`: mitigada la falsificación de IP por `X-Forwarded-For`. | **CORREGIDO Y PROBADO** (`test_client_ip_extraction_resists_x_forwarded_for_spoofing`) |
| **SEC-FIX-02** | *Information Disclosure / Tampering* | `deploy/nginx/nginx.conf:116-127`: preservadas todas las cabeceras HTTP de seguridad dentro de `location /models/`. | **CORREGIDO Y PROBADO** (`TC-ARCH-003`) |
| **SEC-FIX-03** | *Elevation of Privilege / Lateral Movement* | `deploy/network/cisco-ios-vlans-aaa-radius.cfg:131-139` y `firewall-default-deny.sh:14-16`: ACL aplicada con `ip access-group ... in` en `Vlan10` y firewall con `Default Deny` entrante y saliente. | **CORREGIDO Y PROBADO** (`TC-ARCH-006`) |
| **SEC-LOW-01** | *DOM XSS (Defensa en profundidad)* | `frontend/src/interfaz/hud.js` utiliza `innerHTML` únicamente para plantillas estáticas internas; `pantalla.js` usa exclusivamente `textContent`. | **MITIGADO** |

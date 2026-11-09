# Catálogo de Casos de Prueba (`TC`)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Versión:** 1.1
**Total de pruebas automatizadas en Vitest:** **247 pruebas** distribuidas en **12 archivos de suite** (más suite `pytest` en `backend/tests/test_clean_architecture_and_security.py`).

---

## 1. Suites de Cuentas API, Seguridad e Infraestructura (`frontend/tests/account-api.test.js`, `arch-deploy-001.test.js` y `backend/tests/test_clean_architecture_and_security.py`)

| ID Caso | Nombre de la Prueba | Requisito / Caso de Uso | Entrada / Estímulo | Resultado Esperado |
|---|---|---|---|---|
| **TC-API-001** | Registro e inicio de sesión únicamente mediante la API | `RF-009`, `SEG-001`, `CU-002`, `CU-003` | `cuenta.registrar()` y `cuenta.entrar()` con `apiCliente.js` | Envía `POST /api/v1/auth/register` y `/login` con `credentials: 'same-origin'` y adapta el progreso del servidor en memoria. |
| **TC-API-002** | Envío de progreso y token CSRF sin almacenar en navegador | `RF-009`, `SEG-005`, `CU-016` | `api.actualizarProgresoEnServidor()` y `api.cerrarSesionEnServidor()` | Adjunta cabecera `X-CSRF-Token` en `PUT /api/v1/progress` y `POST /api/v1/auth/logout`, limpiando el token CSRF al salir. |
| **TC-API-003** | Reporte de falla del backend sin fallback local | `RF-009`, `SEG-005`, `CU-002`, `CU-003` | Caída simulada de red en `cuenta.entrar()` | Retorna `{ ok: false, mensaje: 'No se pudo conectar con el servidor de cuentas (/api/v1).' }` sin usar `localStorage`. |
| **TC-API-004** | Modo invitado sin persistencia de cuenta | `RF-001`, `CU-003`, `CU-004` | `cuenta.entrarComoInvitado()` seguido de `guardarNivel(2)` | Mantiene sesión `{ invitado: true }` y `nivelGuardado() === 0` sin invocar escrituras remotas ni locales. |
| **TC-ARCH-001 a TC-ARCH-006** | Verificación de Docker, aislamiento de puertos, Nginx TLS (incluyendo `/models/`), Argon2id, anti-spoofing IP, manifiesto `SHA-256`, ACL Cisco (`ip access-group`), Firewall Default Deny bidireccional y DevSecOps Aqua Trivy | `SEG-001` a `SEG-007`, `ARCH-DEPLOY-001` | Inspección de artefactos, cálculo `SHA-256` sobre `.glb`, validación de `nginx.conf`, `dependencies.py`, `cisco-ios-vlans-aaa-radius.cfg`, `firewall-default-deny.sh` y `.github/workflows/devsecops.yml` | Certifica no exposición de `5432`/`8000`, `server_tokens off;`, cabeceras en `/models/`, `X-Forwarded-For $remote_addr`, hashes `SHA-256` exactos, ACL aplicada en `Vlan10`, `ufw default deny outgoing` y `exit-code: "1"` en Trivy. |
| **TC-BACK-001 a TC-BACK-007** | Suite Pytest de Clean Architecture y Seguridad Backend (`test_clean_architecture_and_security.py`) | `SEG-001` a `SEG-005`, `CU-002`, `CU-003`, `CU-016`, `CU-019` | Pruebas con `TestClient(app)` sobre `/api/v1/*` y SQLite/SQLAlchemy | Verifica hashing `Argon2id`, rechazo XSS, bloqueo anti-cheat (`Nivel 1->3` da `403`), bloqueo por fuerza bruta (`423`), revocación de sesión opaca (`401`), CSRF (`403`), aislamiento entre usuarios, restablecimiento por adulteración SQL HMAC y resistencia a spoofing de `X-Forwarded-For`. |

---

## 2. Suites de Dominio Multimedia y Jugabilidad (`frontend/tests/gameplay-domain.test.js`)

| ID Caso | Nombre de la Prueba | Requisito / Caso de Uso | Entrada / Estímulo | Resultado Esperado |
|---|---|---|---|---|
| **TC-DOM-001** | Progresión de misiones y objetivos en los 3 niveles | `RF-004`, `RF-007`, `CU-007`, `CU-008` | Estados de progreso por nivel en `datos.js` | Verifica prerrequisitos y objetivos para Selva, Montaña y Desierto. |
| **TC-DOM-002** | Dinámica térmica de frío, calor de fogata y daño por hipotermia | `RF-006`, `CU-010` | `crearFrio()` fuera y dentro del radio de fogata en Nivel 2 | Fuera del radio de calor el frío sube y drena salud al superar el umbral; cerca del fuego se reduce. |
| **TC-DOM-003** | Estadísticas de armas y detección anatómica `zonaDeBala` | `RF-005`, `CU-009`, `CU-010`, `CU-011` | Impactos a distintas alturas y desplazamientos laterales | Cabeza y pecho centrados producen impacto letal (`mortal: true`, `dano: 100`); extremidades producen daño parcial (`10-18 HP`) y vendaje. |
| **TC-DOM-004** | Consistencia matemática de terreno y nivel de agua en los 3 biomas | `RF-003`, `CU-005` | Evaluación de `altura(x, z)` en meseta del altar, playa y grilla de muestreo | La meseta central permanece sobre el nivel del agua y ninguna coordenada produce `NaN` o `Infinity`. |
| **TC-DOM-005** | Oclusión de proyectiles enemigos contra obstáculos sólidos | `RF-005`, `CU-009` | Disparo enemigo hacia Max con obstáculo interpuesto vs. línea despejada | Con obstáculo interpuesto la bala es bloqueada; sin obstáculo impacta normalmente. |

---

## 3. Suites de Máquina de Estados, Coordinación, Interfaz y Regresión (`frontend/tests/*.test.js`)

| Suite | Archivo | N.º de Pruebas | Cobertura Funcional |
|---|---|---|---|
| **FSM Core** | `frontend/tests/game-state.test.js` | 105 | Estados canónicos, tabla de transiciones, política `POL-FSM-001` e historial acotado. |
| **FSM Coordinator** | `frontend/tests/game-state-coordinator.test.js` | 46 | Candados de exclusión mutua (`transitionLock`, `levelChangePending`, `defeatPending`) y consultas de estado. |
| **FSM Recovery** | `frontend/tests/game-state-recovery.test.js` | 30 | Recuperación ante estados inválidos, reinicios de nivel (`R`), y desbloqueo de candados tras desenlace terminal. |
| **FSM Adapters** | `frontend/tests/game-state-adapters.test.js` | 12 | Adaptadores de diálogo, cinemática del ídolo, transición de nivel y resultado terminal (`derrota` / `victoria`). |
| **Release 004 Regression** | `frontend/tests/release-004-regression.test.js` | 10 | Regresión de flujo de niveles y estados. |
| **Release 005B Level Death** | `frontend/tests/release-005b-level-death.test.js` | 10 | Precedencia de derrota frente a transición de nivel. |
| **Cine Util (Release 005A)** | `frontend/tests/cine-util.test.js` | 8 | Controles táctiles e interfaz cinematográfica. |
| **FSM Characterization** | `frontend/tests/game-state-characterization.test.js` | 7 | Pruebas de caracterización del flujo de `main.js`. |
| **Arch Deploy 001** | `frontend/tests/arch-deploy-001.test.js` | 6 | Infraestructura Docker, Nginx TLS, FastAPI, manifiesto `SHA-256`, red Cisco/Firewall y CI/CD Trivy. |
| **Gameplay Domain** | `frontend/tests/gameplay-domain.test.js` | 5 | Misiones, frío, armas, terreno y colisión de proyectiles. |
| **Account API** | `frontend/tests/account-api.test.js` | 4 | Integración de `cuenta.js` y `apiCliente.js` con `/api/v1` y CSRF sin fallback local. |
| **Game Data Baseline** | `frontend/tests/game-data.test.js` | 4 | Integridad estructural de los catálogos en `datos.js`. |

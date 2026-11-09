# SRS — Especificación de Requisitos de Software: «La Búsqueda del Ídolo Perdido»

**Versión:** 1.1 (Consolidada tras Integración Cliente-Servidor)
**Estado:** Actualizado y verificado contra el árbol de trabajo actual (`dev/jesus`)
**Asignaturas integradas:** Creación de Entornos Multimedia · Sistemas de Comunicación y Seguridad Informática

---

## 1. Introducción

### 1.1 Propósito
Definir y verificar formalmente los requisitos funcionales (`RF`), de seguridad (`SEG`) y no funcionales (`RNF`) del videojuego 3D interactivo **«La Búsqueda del Ídolo Perdido»**, vinculando cada requisito con su implementación real en `frontend/` y `backend/`, su caso de uso (`CU-001` a `CU-019`) y su evidencia de prueba automatizada.

### 1.2 Alcance del Sistema (AS-IS Verificado)
Aplicación web 3D interactiva en tercera persona. El frontend (`frontend/src/`) ejecuta el motor gráfico WebGL/Three.js, los tres biomas 3D (Selva Tropical, Montaña Nevada y Desierto), la interacción con el NPC guía Daniel, las mecánicas de supervivencia y combate anatómico, las cinemáticas y la interfaz de usuario. El backend FastAPI (`backend/app/`, Arquitectura Limpia en 4 capas) gestiona registro, autenticación con **Argon2id**, sesiones opacas revocables, protección **CSRF**, auditoría forense y persistencia de progreso firmada con **HMAC-SHA256** en **PostgreSQL 16** detrás de un gateway TLS **Nginx** (`deploy/nginx/nginx.conf`). El modo invitado permite jugar sin guardar progreso y sin almacenar credenciales ni progreso en Web Storage del navegador.

### 1.3 Stack Tecnológico Real Verificado
- **Lenguaje y módulos:** JavaScript ES Modules (`"type": "module"`) en Frontend y Python 3.12 (FastAPI + SQLAlchemy 2 + Alembic) en Backend.
- **Motor gráfico 3D:** Three.js `^0.186.1` sobre WebGL (`ACESFilmicToneMapping`, sombras `PCFSoftShadowMap`, modelos `.glb` + geometría procedural).
- **Audio:** Web Audio API procedural (`frontend/src/audio/audio.js`, sin archivos MP3/WAV externos).
- **Backend, Criptografía y Persistencia:** FastAPI, SQLAlchemy 2, Alembic y PostgreSQL 16; `Argon2id` (con soporte de verificación `PBKDF2-HMAC-SHA256`) para contraseñas, `HMAC-SHA256` para integridad de progreso, `SHA-256` para tokens de sesión y manifiesto de activos sensibles (`deploy/security/sha256-manifest.json`).
- **Seguridad de Sesión y Transporte:** Cookies `HttpOnly; Secure; SameSite=Strict`, cabecera `X-CSRF-Token` en tiempo constante y terminación TLS 1.2/1.3 en Nginx; el frontend no almacena credenciales ni progreso en Web Storage.
- **Construcción, Pruebas y DevSecOps:** Vite `^8.3.5`, Vitest `^5.1.0` (**12 suites, 247 pruebas automatizadas**), Pytest en backend (`backend/tests/test_clean_architecture_and_security.py`) y pipeline CI/CD con **Aqua Trivy** (`.github/workflows/devsecops.yml`).
- **Pipeline de Assets 3D:** Scripts de Blender en Python (`blender/crear_personajes.py`, `cara.py`, `convertir_mixamo.py`).

---

## 2. Actores del Sistema

El detalle de responsabilidades y evidencia en código se encuentra en `docs/requirements/use-cases.md`.

| ID | Actor | Clasificación | Estado | Evidencia Principal |
|---|---|---|---|---|
| **ACT-001** | **Jugador** | Primario humano | `IMPLEMENTADO` | `frontend/src/main.js`, `frontend/src/cuenta/pantalla.js`, `frontend/src/interfaz/tactil.js` |
| **ACT-002** | **Sistema de Juego** | Secundario lógico autónomo | `IMPLEMENTADO` | Loop `requestAnimationFrame` en `frontend/src/main.js:680-735` |
| **ACT-003** | **NPC / Daniel** | Secundario narrativo | `IMPLEMENTADO` | `frontend/src/personajes/daniel.js`, `frontend/src/juego/datos.js` |
| **ACT-004** | **Administrador / Desarrollador** | Operación y auditoría | `IMPLEMENTADO` (CLI/HTML) | `visor.html`, `niveles.html`, `pruebas.html`, `rendimiento.html`, Vitest CLI, `deploy/scripts/auditar-checklist.ps1` |
| **ACT-005** | **Servicio de Persistencia** | Técnico externo al gameplay | `IMPLEMENTADO` (PostgreSQL 16) | `backend/app/infrastructure/models.py`, `backend/app/infrastructure/repositories.py` |
| **ACT-006** | **Servicio de Autenticación** | Técnico externo al gameplay | `IMPLEMENTADO` (FastAPI IAM) | `frontend/src/cuenta/cuenta.js`, `frontend/src/cuenta/apiCliente.js`, `backend/app/application/use_cases.py`, `backend/app/presentation/routers.py` |

---

## 3. Requisitos Funcionales (`RF`)

| ID | Requisito | Casos de Uso | Estado Real | Evidencia en Código | Criterio de Aceptación Verificado |
|---|---|---|---|---|---|
| **RF-001** | Inicializar motor WebGL, cargar modelos `.glb` y presentar pantalla de inicio/acceso o modo invitado sin bloqueo por pantalla negra. | `CU-001`, `CU-004` | `IMPLEMENTADO` | `frontend/src/main.js`, `frontend/src/cuenta/pantalla.js` | Captura de errores en `iniciar()` con fallback visual; modo invitado disponible sin depender de almacenamiento local. |
| **RF-002** | Controlar desplazamiento, rotación, salto, cámara orbital en 3.ª persona y soporte híbrido teclado/ratón y pantalla táctil. | `CU-005`, `CU-012` | `IMPLEMENTADO` | `frontend/src/main.js`, `frontend/src/juego/camara.js`, `frontend/src/interfaz/tactil.js` | Movimiento continuo con amortiguación exponencial, gravedad, colisión circular y auto-detección táctil. |
| **RF-003** | Generar y renderizar tres biomas diferenciados (Selva, Montaña Nevada, Desierto) con terreno matemático, agua/hielo, vegetación, cielo y nieve. | `CU-005`, `CU-014` | `IMPLEMENTADO` | `frontend/src/escenario/mundo.js`, `temas.js`, `terreno.js` | Cada nivel aplica su paleta, niebla, terreno (`altura`), agua/hielo y partículas ambientales. |
| **RF-004** | Guiar al jugador mediante el NPC Daniel, mostrando diálogos contextuales y actualizando el HUD de misión. | `CU-006`, `CU-007`, `CU-008`, `CU-013` | `IMPLEMENTADO` | `frontend/src/personajes/daniel.js`, `main.js`, `interfaz/hud.js` | Interacción con tecla `E`; avance de líneas y marcado visual de objetivos en el HUD. |
| **RF-005** | Simular combate armado (cuchillo cuerpo a cuerpo y armas de fuego), IA de persecución/disparo enemigo y daño anatómico por zonas. | `CU-009`, `CU-010`, `CU-011` | `IMPLEMENTADO` | `frontend/src/juego/combate.js`, `personajes/armas.js`, `personajes/enemigo.js` | Impactos en cabeza/pecho son letales (`mortal: true`); extremidades aplican daño parcial (`10-18 HP`) y vendajes visibles (`herir`). |
| **RF-006** | Gestionar supervivencia ambiental (frío en Nivel 2 y calor de fogata), recolección de suministros (armas y botiquines). | `CU-010`, `CU-011` | `IMPLEMENTADO` | `frontend/src/juego/frio.js`, `juego/suministros.js`, `escenario/botiquines.js` | En Nivel 2, fuera del radio de calor, el frío sube y drena salud al superar el umbral; los botiquines restauran `+40 HP`. |
| **RF-007** | Ejecutar cinemáticas, activar el portal de salida y transicionar entre los 3 niveles hasta la escena final en la cabaña. | `CU-008`, `CU-013`, `CU-014`, `CU-015` | `IMPLEMENTADO` | `frontend/src/escenario/cinematica.js`, `portal.js`, `casa.js`, `main.js` | Al recoger el ídolo con prerrequisitos cumplidos, se abre el portal y el Nivel 3 culmina en `montarEscenaFinal`. |
| **RF-008** | Permitir pausar/reanudar (`ESC`), ajustar resolución/calidad gráfica y reiniciar nivel o partida tras derrota/victoria (`R` / botones UI). | `CU-012`, `CU-015`, `CU-017` | `IMPLEMENTADO` | `frontend/src/main.js`, `juego/detalle.js` | Pausa detiene el delta de simulación y muestra `#pausa`; derrota y victoria muestran pantallas de cierre y opción de reinicio. |
| **RF-009** | Registrar cuentas, autenticar sesiones y persistir el nivel desbloqueado, victorias y mejor tiempo por jugador mediante el backend. | `CU-002`, `CU-003`, `CU-016` | `IMPLEMENTADO` (Backend) | `frontend/src/cuenta/cuenta.js`, `apiCliente.js`, `backend/app/presentation/routers.py`, `backend/app/application/use_cases.py` | El backend persiste el progreso en PostgreSQL y lo recupera tras recargar mediante la sesión autenticada sin fallback local. |

---

## 4. Requisitos de Seguridad (`SEG`)

El análisis detallado y la trazabilidad de las Semanas 1 a 10 se documentan en `docs/security/security-audit.md` y `docs/security/checklist-cumplimiento-semanas-1-10.md`.

| ID | Requisito de Seguridad | Casos de Uso | Estado Real | Evidencia en Código | Pruebas Automatizadas |
|---|---|---|---|---|---|
| **SEG-001** | Derivación/hashing de contraseñas con **Argon2id** (y soporte PBKDF2-HMAC-SHA256 de 150 000 iteraciones) con sal aleatoria de 16 bytes y comparación en tiempo constante. | `CU-002`, `CU-003`, `CU-019` | `IMPLEMENTADO` | `backend/app/core/security.py:14-74`, `backend/app/application/use_cases.py` | `backend/tests/test_clean_architecture_and_security.py`, `TC-ARCH-004` |
| **SEG-002** | Firma de integridad de progreso con **HMAC-SHA256** en servidor y manifiesto **SHA-256** de activos binarios sensibles. | `CU-016`, `CU-019` | `IMPLEMENTADO` | `backend/app/core/security.py:97-111`, `deploy/security/sha256-manifest.json` | `backend/tests/test_clean_architecture_and_security.py`, `TC-ARCH-006` |
| **SEG-003** | Validación estricta de entradas en backend (`extra="forbid"`) y prevención de XSS en DOM (`textContent`). | `CU-002`, `CU-003`, `CU-019` | `IMPLEMENTADO` | `backend/app/domain/entities/user.py`, `backend/app/presentation/schemas.py`, `frontend/src/cuenta/pantalla.js` | `backend/tests/test_clean_architecture_and_security.py`, `frontend/tests/account-api.test.js` |
| **SEG-004** | Limitación de intentos fallidos de login (bloqueo exponencial `HTTP 423`) y Rate Limiting por IP (`HTTP 429`) resistente a spoofing de `X-Forwarded-For`. | `CU-003`, `CU-019` | `IMPLEMENTADO` | `backend/app/domain/entities/user.py`, `backend/app/main.py:40-65`, `backend/app/presentation/dependencies.py:16-48`, `deploy/nginx/nginx.conf:26-28` | `backend/tests/test_clean_architecture_and_security.py`, `TC-ARCH-003`, `TC-ARCH-004` |
| **SEG-005** | Sesiones opacas revocables (hash `SHA-256` en BD) en cookie `HttpOnly; Secure; SameSite=Strict` y protección CSRF. | `CU-003`, `CU-016`, `CU-019` | `IMPLEMENTADO` | `backend/app/presentation/routers.py:39-59`, `backend/app/presentation/dependencies.py:64-88`, `frontend/src/cuenta/apiCliente.js` | `backend/tests/test_clean_architecture_and_security.py`, `frontend/tests/account-api.test.js` |
| **SEG-006** | Hardening de Nginx TLS 1.2/1.3, ocultamiento de versión (`server_tokens off;`), cabeceras HTTP defensivas (incluido `/models/`), aislamiento Docker y plantillas de red/firewall. | `CU-019` | `IMPLEMENTADO` (Config/Código; validación de red en laboratorio) | `deploy/nginx/nginx.conf`, `compose.yaml`, `deploy/network/cisco-ios-vlans-aaa-radius.cfg`, `deploy/network/firewall-default-deny.sh`, `frontend/vite.config.js` | `frontend/tests/arch-deploy-001.test.js` (`TC-ARCH-001` a `TC-ARCH-006`) |
| **SEG-007** | Pipeline CI/CD DevSecOps con **Aqua Trivy** (SAST/SCA/Imágenes Docker) y mecanismo de falla controlada (`exit-code: "1"`). | `CU-019` | `IMPLEMENTADO` (Workflow configurado) | `.github/workflows/devsecops.yml` | `TC-ARCH-006` (`frontend/tests/arch-deploy-001.test.js`) |

---

## 5. Requisitos No Funcionales (`RNF`)

| ID | Categoría | Descripción y Métrica | Estado Real | Evidencia |
|---|---|---|---|---|
| **RNF-001** | **Rendimiento** | Mantener simulación estable (`dt = min(delta, 0.05)`) y ajuste dinámico de resolución y calidad gráfica. | `IMPLEMENTADO` | `frontend/src/main.js`, `frontend/src/juego/detalle.js`, `frontend/src/herramientas/rendimiento.js` |
| **RNF-002** | **Mantenibilidad** | Separación modular por dominios en `frontend/src/`, Clean Architecture de 4 capas en `backend/app/` y FSM desacoplada bajo `ADR-001`/`ADR-002`. | `IMPLEMENTADO` | `frontend/src/`, `backend/app/`, `frontend/src/juego/game-state-*.js` |
| **RNF-003** | **Testabilidad** | Ejecución determinista en Vitest (**12 suites, 247 pruebas**) y Pytest en backend para seguridad, dominio, API y máquina de estados. | `IMPLEMENTADO` | `frontend/tests/*.test.js` (12 suites, 247 pruebas); `backend/tests/test_clean_architecture_and_security.py` |
| **RNF-004** | **Compatibilidad y Usabilidad** | Diseño adaptable a escritorio y móviles/tablets (`responsivo.css`, `tactil.js`), atributos ARIA y modo invitado sin dependencia de almacenamiento local. | `IMPLEMENTADO` | `frontend/src/interfaz/dispositivo.js`, `tactil.js`, `cuenta/pantalla.js` |

---

## 6. Documentos Relacionados
- **Catálogo de Actores y Casos de Uso (`CU-001` a `CU-019`):** `docs/requirements/use-cases.md`
- **Matriz de Trazabilidad Completa:** `docs/requirements/traceability.md`
- **Arquitectura AS-IS, TO-BE y Despliegue (`ARCH-DEPLOY-001`):** `docs/architecture/current-architecture.md`, `docs/architecture/target-architecture.md` y `docs/architecture/arch-deploy-001.md`
- **Auditoría de Seguridad y Checklist Semanas 1-10:** `docs/security/security-audit.md`, `docs/security/checklist-cumplimiento-semanas-1-10.md` y `docs/security/raspberry-pentest-playbook.md`
- **Estrategia, Casos, Resultados de Pruebas y Matriz ISO:** `docs/quality/test-strategy.md`, `docs/quality/test-cases.md`, `docs/quality/test-results.md` y `docs/quality/iso-compliance-matrix.md`

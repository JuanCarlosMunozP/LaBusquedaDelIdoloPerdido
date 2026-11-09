# Lista de Verificación de Entrega, Limitaciones Conocidas y Guion de Sustentación Académica

**Proyecto:** La Búsqueda del Ídolo Perdido
**Fecha de actualización:** 8 de noviembre de 2026
**Rama:** `dev/jesus`
**Asignaturas:** Creación de Entornos Multimedia · Sistemas de Comunicación y Seguridad Informática

---

## 1. Verificación de los 14 Criterios de Finalización

| # | Criterio de Finalización | Estado | Evidencia / Ubicación |
|---|---|---|---|
| 1 | El juego inicia sin errores críticos | **CUMPLIDO** | `frontend/src/main.js` con manejo de errores de carga y modo invitado sin dependencia de almacenamiento local. |
| 2 | Los tres niveles son jugables o cuentan con diagnóstico documentado | **CUMPLIDO** | Niveles 1 (Selva), 2 (Montaña Nevada) y 3 (Desierto) verificados en `temas.js`, `mundo.js`, `datos.js` y `gameplay-domain.test.js`. |
| 3 | Las misiones pueden completarse | **CUMPLIDO** | Flujo completo Daniel → Suministros/Fogata → Ídolo → Portal verificado por `TC-DOM-001`. |
| 4 | Las transiciones funcionan | **CUMPLIDO** | Cinemática de playa, cinemática del ídolo, portales entre niveles y escena final en casa (`casa.js`). |
| 5 | El HUD refleja el estado real | **CUMPLIDO** | Salud, barra de frío, inventario de armas/munición/botiquines, objetivos y placa de cuenta activa (`interfaz/hud.js`). |
| 6 | La persistencia disponible funciona | **CUMPLIDO** | Registro, sesión y progreso persistidos en **PostgreSQL 16** a través de **FastAPI** (`/api/v1`) y `apiCliente.js`, sin fallback local (`frontend/tests/account-api.test.js`, `TC-ARCH-005`). |
| 7 | Los controles de seguridad están verificados (Semanas 1 a 10) | **CUMPLIDO** | `Argon2id` + `PBKDF2-SHA256`, `HMAC-SHA256`, manifiesto `SHA-256` (`sha256-manifest.json`), Nginx TLS 1.2/1.3, `server_tokens off;`, cabeceras en `/` y `/models/`, anti-spoofing IP, Rate Limiting `429`, Docker aislado y pipeline DevSecOps con **Aqua Trivy** (`checklist-cumplimiento-semanas-1-10.md`). |
| 8 | Las pruebas automatizadas pasan | **CUMPLIDO** | **12 archivos de prueba, 247 tests aprobados (`0` fallos)** con `npm --prefix frontend test -- --run` + suite backend en `backend/tests/test_clean_architecture_and_security.py`. |
| 9 | El build de producción funciona | **CUMPLIDO** | `npm --prefix frontend run build` transforma 48 módulos con código de salida `0`. |
| 10 | La arquitectura está documentada | **CUMPLIDO** | `docs/architecture/current-architecture.md`, `target-architecture.md` y `arch-deploy-001.md`. |
| 11 | Los casos de uso y actores están completos | **CUMPLIDO** | `ACT-001` a `ACT-006` y `CU-001` a `CU-019` en `docs/requirements/use-cases.md`. |
| 12 | Los 8 diagramas Mermaid están generados | **CUMPLIDO** | Incluidos y validados en `docs/architecture/current-architecture.md` (Sección 4.1 a 4.8). |
| 13 | La matriz de trazabilidad está completa | **CUMPLIDO** | `docs/requirements/traceability.md`, `docs/security/checklist-cumplimiento-semanas-1-10.md` y `docs/quality/iso-compliance-matrix.md`. |
| 14 | El proyecto puede explicarse y demostrarse en vivo | **CUMPLIDO** | Guion paso a paso incluido en la Sección 3 de este documento. |

---

## 2. Limitaciones Conocidas y Deuda Técnica Transparente

1. **Separación entre Controles Verificados en Código y Pruebas de Laboratorio en Vivo:**
   - Los controles de aplicación, criptografía (`Argon2id`, `HMAC-SHA256`, `SHA-256`), sesiones `HttpOnly`, CSRF, anti-spoofing de IP y configuraciones Nginx/Docker/Cisco/Firewall están verificados por pruebas automatizadas. La acreditación dinámica de red (`Nmap`, `Wireshark`, `Apache Benchmark ab` y equipamiento físico Cisco/WiFi) debe ejecutarse sobre el contenedor/laboratorio activo siguiendo [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md).
2. **Subsistema FSM (`FSM-002` a `FSM-010`) en Aislamiento Controlado:**
   - Los módulos `game-state-machine.js`, `game-state-coordinator.js` y `game-state-adapters.js` están implementados y cubiertos por pruebas unitarias, pero se mantienen desacoplados de `main.js` en cumplimiento de `AGENTS.md` (`ADR-001` y `ADR-002`).

---

## 3. Guion de Exposición y Demostración en Vivo (10–12 Minutos)

### Parte 1 — Introducción y Arquitectura Cliente-Servidor (2 min)
1. Mostrar el diagrama de despliegue (`docs/architecture/arch-deploy-001.md`) explicando cómo el proyecto une **Creación de Entornos Multimedia** (Three.js, WebGL, modelos `.glb` verificados con `SHA-256`, terrenos matemáticos y síntesis Web Audio) con **Seguridad Informática** (Gateway TLS Nginx + FastAPI Clean Architecture + PostgreSQL 16 aislado en `backend_net`).

### Parte 2 — Demostración de Seguridad Informática en Vivo (4 min)
1. Levantar el entorno (`docker compose -f compose.yaml -f compose.local.yaml up -d --build` o en la Raspberry Pi con `compose.raspberry.yaml`).
2. **Registro, Argon2id, Cookie `HttpOnly` y CSRF (`CU-002`, `SEG-001`, `SEG-005`):**
   - Crear un usuario desde la interfaz del juego y mostrar en **Chrome DevTools → Application** que `localStorage` y `sessionStorage` no contienen contraseñas ni tokens de sesión en claro (la sesión viaja en cookie `HttpOnly` + cabecera `X-CSRF-Token`).
3. **Demostración de Anti-Cheat, Fuerza Bruta y Bitácora SIEM (`SEG-002`, `SEG-004`, `SEG-008`):**
   - Ejecutar los escenarios de [raspberry-pentest-playbook.md](file:///c:/Estudio/Seguridad-Multimedia/docs/security/raspberry-pentest-playbook.md): bloqueo de salto ilegal de nivel (`HTTP 403`), bloqueo exponencial tras 3 intentos fallidos (`HTTP 423`) y consulta de `/api/v1/security/audit-logs`.
4. **Hardening, Red y Resiliencia DoS (Semanas 2 a 10):**
   - Ejecutar `.\deploy\scripts\auditar-checklist.ps1 -UrlObjetivo https://127.0.0.1:8443/api/v1/health` para comprobar hashes `SHA-256`, tests y cabeceras con `curl.exe -I`.
   - Mostrar las pruebas de aislamiento con `nmap -sV --script vuln` y mitigación DoS con `ab -n 200 -c 30`.

### Parte 3 — Demostración Multimedia y Gameplay en los 3 Niveles (4 min)
1. **Nivel 1 (Selva), Nivel 2 (Montaña Nevada) y Nivel 3 (Desierto):**
   - Mostrar diálogo con Daniel (`E`), recolección de armas/botiquines, combate por zonas corporales, mecánica de frío/fogata en la montaña, recolección del ídolo de oro y transición por el portal hasta la escena final en casa (`casa.js`).
   - Mostrar las herramientas de diagnóstico en vivo: `/pruebas.html`, `/visor.html`, `/niveles.html` y `/rendimiento.html`.

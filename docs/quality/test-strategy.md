# Estrategia Integral de Pruebas (QA & DevSecOps)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Versión:** 1.1
**Marco de Ejecución:** Vitest `^5.1.0` (CLI Node) + Pytest (Backend FastAPI) + Suite Interactiva en Navegador (`/pruebas.html`) + Verificación de Build Vite `^8.3.5`

---

## 1. Objetivos de Calidad

Garantizar con evidencia reproducible que tanto los subsistemas de **Creación de Entornos Multimedia** (físicas 2.5D, terreno, combate anatómico, misiones, supervivencia al frío y máquina de estados) como los de **Seguridad Informática** (`Argon2id`, `HMAC-SHA256`, manifiesto `SHA-256`, sesiones opacas en cookie `HttpOnly`, protección CSRF, resistencia a spoofing de IP, endurecimiento Nginx/Docker y plantillas de red) funcionan conforme a la especificación (`docs/requirements/SRS.md`).

---

## 2. Niveles y Tipos de Prueba Separados

### 2.1 Pruebas Unitarias Puras (`frontend/tests/*.test.js`)
Evalúan funciones y clases deterministas sin dependencias de red ni contexto WebGL nativo:
- **Máquina de Estados Formal (`game-state.test.js`):** 9 estados, transiciones válidas/inválidas, historial acotado y política de precedencia `POL-FSM-001`.
- **Coordinador y Recuperación de Estados (`game-state-coordinator.test.js`, `game-state-recovery.test.js`):** Candados de exclusión mutua (`transitionLock`, `levelChangePending`, `defeatPending`) y recuperación.
- **Dominio de Juego (`gameplay-domain.test.js`, `game-data.test.js`):** Progresión de misiones en los 3 niveles (`datos.js`), cálculo de enfriamiento y daño por hipotermia (`frio.js`), zonas anatómicas de impacto de bala (`armas.js`), altura de terreno/agua (`terreno.js`, `temas.js`) y oclusión de proyectiles.

### 2.2 Pruebas de Integración Simulada y Adaptadores (`game-state-adapters.test.js`, `release-004-regression.test.js`, `release-005b-level-death.test.js`, `cine-util.test.js`)
Verifican la interacción entre los adaptadores de diálogo, cinemática del ídolo, transición de nivel, controles táctiles y desenlace terminal (`derrota` / `victoria`).

### 2.3 Pruebas de Cuentas API, Seguridad Criptográfica e Infraestructura (`account-api.test.js`, `arch-deploy-001.test.js` y `backend/tests/test_clean_architecture_and_security.py`)
Verifican la frontera cliente-servidor y los controles de las Semanas 1 a 10:
- Integración de `cuenta.js` y `apiCliente.js` con `/api/v1`, envío de cabecera `X-CSRF-Token` y ausencia de fallback a almacenamiento local (`account-api.test.js`, `TC-ARCH-005`).
- Hashing `Argon2id` y `PBKDF2-HMAC-SHA256` (`150 000` iteraciones), firma `HMAC-SHA256` de progreso en BD, revocación de sesiones opacas, bloqueo por fuerza bruta (`HTTP 423`), anti-cheat (`HTTP 403`) y extracción de IP resistente a spoofing de `X-Forwarded-For` (`test_clean_architecture_and_security.py`).
- Verificación criptográfica `SHA-256` sobre activos binarios sensibles (`deploy/security/sha256-manifest.json`), preservación de cabeceras de seguridad en `/models/` en `nginx.conf`, aplicación de ACL Cisco con `ip access-group`, firewall `Default Deny` bidireccional y pipeline DevSecOps con **Aqua Trivy** (`TC-ARCH-001` a `TC-ARCH-006`).

### 2.4 Pruebas de Diagnóstico Visual y WebGL en Navegador (`frontend/pruebas.html`)
El proyecto incluye un arnés de pruebas en navegador (`frontend/src/herramientas/pruebas.js`) accesible en `http://localhost:5173/pruebas.html` que ejecuta más de **40 aserciones en vivo** con contexto WebGL y modelos `.glb` reales (verificación de articulaciones de personajes, animación de muerte, creación/destrucción de los 3 biomas, colisión con obstáculos, cámara y efectos de sonido).

### 2.5 Pruebas de Construcción y Empaquetado (`npm run build`)
Validan que todos los módulos ES, hojas de estilo y referencias estáticas compilen sin errores de sintaxis ni importaciones circulares rotas mediante Vite `^8.3.5`.

---

## 3. Comandos de Ejecución Reproducible

Desde la raíz del repositorio (`C:\Estudio\Seguridad-Multimedia`):

```powershell
# 1. Ejecutar las 12 suites automatizadas en Vitest (247 pruebas)
npm --prefix frontend test -- --run

# 2. Verificar el empaquetado de producción con Vite
npm --prefix frontend run build

# 3. Ejecutar el script de auditoría técnica (artefactos, hashes SHA-256, suites y cabeceras opcionales en vivo)
.\deploy\scripts\auditar-checklist.ps1
```

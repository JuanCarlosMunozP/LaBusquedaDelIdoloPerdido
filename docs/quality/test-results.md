# Informe de Resultados de Pruebas y Construcción (`Test Results`)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Fecha de Ejecución:** 8 de noviembre de 2026
**Rama / Commit base:** `dev/jesus` (`ce22536` + correcciones de seguridad e infraestructura)
**Entorno:** Windows · Node.js · Vite `v8.3.5` · Vitest `v5.1.0`

---

## 1. Resumen Ejecutivo de Ejecución Real

| Verificación | Comando Ejecutado | Estado | Métrica Obtenida |
|---|---|---|---|
| **Suite de Pruebas Automatizadas (Vitest)** | `npm --prefix frontend test -- --run` | **APROBADO (`PASS`)** | **12 suites aprobadas · 247 pruebas aprobadas · 0 fallos** |
| **Build de Producción (Vite)** | `npm --prefix frontend run build` | **APROBADO (`PASS`)** | **48 módulos transformados · `exit code 0`** |
| **Verificación de Integridad `SHA-256` (Semana 1)** | `Get-FileHash` / `TC-ARCH-006` (`sha256-manifest.json`) | **APROBADO (`PASS`)** | **`daniel.glb` (`93d4c73e...`) e `idolo.glb` (`e7c23caa...`) verificados** |
| **Pruebas en Vivo de Contenedores / Red (`Docker`, `Nmap`, `ab`)** | `deploy/scripts/auditar-checklist.ps1 -UrlObjetivo ...` | **PENDIENTE EN VIVO** | **Verificable al levantar Docker / Laboratorio según `raspberry-pentest-playbook.md`** |

---

## 2. Desglose por Suite de Pruebas (`Vitest v5.1.0`)

```text
 RUN  v5.1.0 C:/Estudio/Seguridad-Multimedia/frontend

 ✓ tests/game-state-recovery.test.js (30 tests)
 ✓ tests/arch-deploy-001.test.js (6 tests)
 ✓ tests/game-state.test.js (105 tests)
 ✓ tests/cine-util.test.js (8 tests)
 ✓ tests/game-state-characterization.test.js (7 tests)
 ✓ tests/release-005b-level-death.test.js (10 tests)
 ✓ tests/game-state-coordinator.test.js (46 tests)
 ✓ tests/game-state-adapters.test.js (12 tests)
 ✓ tests/game-data.test.js (4 tests)
 ✓ tests/release-004-regression.test.js (10 tests)
 ✓ tests/gameplay-domain.test.js (5 tests)
 ✓ tests/account-api.test.js (4 tests)

 Test Files  12 passed (12)
      Tests  247 passed (247)
```

---

## 3. Evidencia de Construcción de Producción (`Vite v8.3.5`)

```text
> axel-la-isla-perdida@0.0.0 build
> vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 48 modules transformed.
dist/index.html                   3.01 kB │ gzip:   1.27 kB
dist/assets/index-Bkk178Fc.css   10.12 kB │ gzip:   2.90 kB
dist/assets/pantalla-CGfPEmGk.js  2.95 kB │ gzip:   1.36 kB
dist/assets/index-B-3H8o0B.js   751.40 kB │ gzip: 202.83 kB
```

- **Observación no bloqueante:** Vite emite un aviso estándar de tamaño de chunk (`~751 kB` minificado / `~203 kB` gzip) debido a la inclusión del motor `three` en el bundle principal. `cuenta/pantalla.js` se carga mediante importación dinámica (`await import('./pantalla.js')`), generando un chunk separado.

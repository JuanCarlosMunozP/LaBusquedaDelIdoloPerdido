import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');

describe('ARCH-DEPLOY-001: Verificación de infraestructura Docker, Nginx, PostgreSQL, Alembic y Clean Architecture', () => {
  it('TC-ARCH-001: existen los artefactos obligatorios de Docker, Nginx, Alembic y FastAPI Clean Architecture', () => {
    const requeridos = [
      'compose.yaml',
      'compose.raspberry.yaml',
      'compose.vps.yaml',
      'backend/Dockerfile',
      'frontend/Dockerfile',
      'deploy/nginx/nginx.conf',
      'deploy/nginx/entrypoint-tls.sh',
      '.env.example',
      'backend/alembic.ini',
      'backend/alembic/env.py',
      'backend/alembic/versions/0001_initial_schema.py',
      'backend/app/domain/entities/user.py',
      'backend/app/domain/entities/progress.py',
      'backend/app/domain/entities/session.py',
      'backend/app/application/use_cases.py',
      'backend/app/infrastructure/models.py',
      'backend/app/infrastructure/repositories.py',
      'backend/app/presentation/routers.py',
    ];
    for (const archivo of requeridos) {
      expect(existsSync(resolve(root, archivo)), `Falta ${archivo}`).toBe(true);
    }
  });

  it('TC-ARCH-002: PostgreSQL (5432) y FastAPI (8000) no publican puertos al host y backend_net es internal: true', () => {
    const base = leer('compose.yaml');
    const rpi = leer('compose.raspberry.yaml');
    const vps = leer('compose.vps.yaml');

    expect(base).toContain('frontend_net:');
    expect(base).toContain('backend_net:');
    expect(base).toContain('internal: true');

    // Ni compose.yaml, ni compose.raspberry.yaml, ni compose.vps.yaml publican 5432 o 8000 en ports:
    for (const contenido of [base, rpi, vps]) {
      expect(contenido).not.toMatch(/ports:[\s\S]*?(?:5432|8000)\b/);
    }

    // Solo el servicio nginx define mapeo de puertos HTTP/HTTPS
    expect(rpi).toMatch(/nginx:[\s\S]*?ports:/);
    expect(vps).toMatch(/nginx:[\s\S]*?ports:/);
  });

  it('TC-ARCH-003: Hardening de Nginx exige TLS 1.2/1.3, ocultamiento de versión, CSP, HSTS, Rate Limiting y cabeceras en /models/', () => {
    const nginx = leer('deploy/nginx/nginx.conf');
    expect(nginx).toContain('server_tokens off;');
    expect(nginx).toContain('ssl_protocols       TLSv1.2 TLSv1.3;');
    expect(nginx).toContain('Strict-Transport-Security');
    expect(nginx).toContain('Content-Security-Policy');
    expect(nginx).toContain('X-Frame-Options "DENY"');
    expect(nginx).toContain('X-Content-Type-Options "nosniff"');
    expect(nginx).toContain('limit_req_zone');
    expect(nginx).toContain('proxy_pass http://fastapi_backend;');
    expect(nginx).toContain('proxy_set_header X-Forwarded-For $remote_addr;');
    expect(nginx).not.toContain('$proxy_add_x_forwarded_for');

    // Verificar que location /models/ preserva las cabeceras de seguridad junto con Cache-Control
    const bloqueModels = nginx.match(/location \/models\/ \{[\s\S]*?\}/)?.[0] || '';
    expect(bloqueModels).toContain('Cache-Control "public, immutable"');
    expect(bloqueModels).toContain('X-Content-Type-Options "nosniff"');
    expect(bloqueModels).toContain('X-Frame-Options "DENY"');
    expect(bloqueModels).toContain('Strict-Transport-Security');
  });

  it('TC-ARCH-004: Backend implementa Argon2id, sesiones opacas revocables, CSRF, anti-spoofing IP, Alembic y endpoints /api/v1', () => {
    const reqs = leer('backend/requirements.txt');
    const sec = leer('backend/app/core/security.py');
    const deps = leer('backend/app/presentation/dependencies.py');
    const routers = leer('backend/app/presentation/routers.py');
    const migration = leer('backend/alembic/versions/0001_initial_schema.py');

    expect(reqs).toContain('argon2-cffi');
    expect(reqs).toContain('alembic');
    expect(sec).toContain('PasswordHasher');
    expect(sec).toContain('Type.ID');
    expect(sec).toContain('hash_session_token');
    expect(deps).toContain('require_csrf_protection');
    expect(deps).toContain('require_admin_access');
    expect(deps).toContain('_is_trusted_proxy');
    expect(deps).toContain('hops[-1]');
    expect(routers).toContain('APIRouter(prefix="/api/v1")');
    expect(migration).toContain('"user_sessions"');
    expect(migration).toContain('"security_audit_logs"');
  });

  it('TC-ARCH-005: cuenta.js delega registro e inicio de sesión al backend sin fallback local', async () => {
    const cuenta = await import('../src/cuenta/cuenta.js');
    const api = await import('../src/cuenta/apiCliente.js');

    api.configurarFetchApi(async () => {
      throw new Error('Network unreachable');
    });

    const fallo = await cuenta.registrar('MaxServer', 'ClaveSegura123');
    expect(fallo.ok).toBe(false);
    expect(fallo.mensaje).toContain('No se pudo conectar con el servidor');

    api.configurarFetchApi(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'csrf-server-token' },
      json: async () => ({
        nombre: 'MaxServer',
        csrfToken: 'csrf-server-token',
        progreso: { nivel: 2, mejorTiempo: 120, victorias: 1 },
      }),
    }));

    const exito = await cuenta.entrar('MaxServer', 'ClaveSegura123');
    expect(exito.ok).toBe(true);
    expect(cuenta.usuario()?.remoto).toBe(true);
    expect(cuenta.nivelGuardado()).toBe(1);

    api.configurarFetchApi(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true }),
    }));
    await cuenta.cerrarSesion();
  });

  it('TC-ARCH-006: pipeline DevSecOps Trivy, integridad SHA-256 de archivos sensibles, ACL Cisco aplicada y Firewall Default Deny bidireccional', () => {
    const archivos = [
      '.github/workflows/devsecops.yml',
      'docs/security/checklist-cumplimiento-semanas-1-10.md',
      'deploy/network/cisco-ios-vlans-aaa-radius.cfg',
      'deploy/network/wpa3-aes-supplicant.conf',
      'deploy/network/firewall-default-deny.sh',
      'deploy/security/sha256-manifest.json',
      'deploy/scripts/auditar-checklist.ps1',
    ];
    for (const rel of archivos) {
      expect(existsSync(resolve(root, rel)), `Falta ${rel}`).toBe(true);
    }

    // Verificar manifiesto SHA-256 contra los archivos binarios reales (Semana 1)
    const manifest = JSON.parse(leer('deploy/security/sha256-manifest.json'));
    for (const [relPath, meta] of Object.entries(manifest.files)) {
      const buf = readFileSync(resolve(root, relPath));
      const digest = createHash('sha256').update(buf).digest('hex');
      expect(digest).toBe(meta.sha256);
      expect(buf.byteLength).toBe(meta.bytes);
    }

    const workflow = leer('.github/workflows/devsecops.yml');
    // Trivy corre desde su imagen oficial con version fija (sin trivy-action/setup-trivy).
    expect(workflow).toMatch(/TRIVY_IMAGE:\s*aquasec\/trivy:\d+\.\d+\.\d+/);
    expect(workflow).not.toContain('aquasecurity/trivy-action');
    expect(workflow).toContain('--severity CRITICAL,HIGH');
    expect(workflow).toContain('--exit-code 1');

    const cisco = leer('deploy/network/cisco-ios-vlans-aaa-radius.cfg');
    expect(cisco).toContain('vlan 10');
    expect(cisco).toContain('vlan 20');
    expect(cisco).toContain('aaa authentication login default group radius local');
    expect(cisco).toContain('ip access-group ACL_USUARIOS_A_SERVIDORES in');

    const wpa = leer('deploy/network/wpa3-aes-supplicant.conf');
    expect(wpa).toContain('CCMP');
    expect(wpa).toContain('SAE');

    const fw = leer('deploy/network/firewall-default-deny.sh');
    expect(fw).toContain('ufw default deny incoming');
    expect(fw).toContain('ufw default deny outgoing');
    expect(fw).toContain('ufw default deny routed');

    const viteCfg = leer('frontend/vite.config.js');
    expect(viteCfg).toContain("'X-Frame-Options': 'SAMEORIGIN'");
    expect(viteCfg).toContain("'X-Content-Type-Options': 'nosniff'");

    const playbook = leer('docs/security/raspberry-pentest-playbook.md');
    expect(playbook).toContain('nmap -sV --script vuln');
    expect(playbook).toContain('curl.exe -I');
    expect(playbook).toContain('ab -n 200 -c 30');
  });
});

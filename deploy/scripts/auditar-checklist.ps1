<#
.SYNOPSIS
    Script de auditoría técnica verificable para el Checklist de Seguridad Informática (Semanas 1 a 10).
.DESCRIPTION
    Separa de forma transparente las verificaciones ejecutadas en el entorno local de las verificaciones
    que requieren el entorno Docker/Red activo, sin declarar porcentajes no sustentados:
    1. Verificación estática de artefactos de código, red, contenedor y CI/CD.
    2. Verificación criptográfica de integridad SHA-256 sobre archivos sensibles (deploy/security/sha256-manifest.json).
    3. Ejecución de las suites automatizadas de pruebas (Vitest).
    4. Auditoría dinámica opcional contra el endpoint HTTPS activo (-UrlObjetivo).
.PARAMETER UrlObjetivo
    URL opcional del servidor en ejecución (por ejemplo "https://127.0.0.1:8443/api/v1/health" o "http://localhost:5173/").
#>
param(
    [string]$UrlObjetivo = ""
)

$ErrorActionPreference = "Stop"
$Raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " AUDITORIA TECNICA DE SEGURIDAD INFORMATICA (SEMANAS 1 A 10)" -ForegroundColor Cyan
Write-Host " Proyecto: La Busqueda del Idolo Perdido" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Verificación estática de artefactos en el árbol de trabajo actual
$ArtefactosRequeridos = @(
    "frontend/src/cuenta/cuenta.js",
    "frontend/src/cuenta/apiCliente.js",
    "backend/app/core/security.py",
    "backend/app/presentation/dependencies.py",
    "deploy/nginx/nginx.conf",
    "deploy/nginx/entrypoint-tls.sh",
    "deploy/network/cisco-ios-vlans-aaa-radius.cfg",
    "deploy/network/wpa3-aes-supplicant.conf",
    "deploy/network/firewall-default-deny.sh",
    "deploy/security/sha256-manifest.json",
    ".github/workflows/devsecops.yml",
    "docs/security/checklist-cumplimiento-semanas-1-10.md",
    "docs/security/raspberry-pentest-playbook.md"
)

Write-Host "`n[1/4] Verificando existencia de artefactos en repositorio..." -ForegroundColor Yellow
foreach ($rel in $ArtefactosRequeridos) {
    $ruta = Join-Path $Raiz $rel
    if (-not (Test-Path $ruta)) {
        throw "Falta artefacto obligatorio: $rel"
    }
    Write-Host "  [OK] $rel" -ForegroundColor Green
}

# 2. Verificación criptográfica SHA-256 de archivos sensibles (Semana 1)
Write-Host "`n[2/4] Verificando integridad SHA-256 de archivos sensibles (Semana 1)..." -ForegroundColor Yellow
$ManifiestoRuta = Join-Path $Raiz "deploy/security/sha256-manifest.json"
$Manifiesto = Get-Content $ManifiestoRuta -Raw | ConvertFrom-Json
foreach ($prop in $Manifiesto.files.PSObject.Properties) {
    $archivoRel = $prop.Name
    $esperado = $prop.Value.sha256.ToLowerInvariant()
    $bytesEsperados = [int64]$prop.Value.bytes
    $archivoAbs = Join-Path $Raiz $archivoRel
    $item = Get-Item -Path $archivoAbs
    $calculado = (Get-FileHash -Path $archivoAbs -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($calculado -ne $esperado -or $item.Length -ne $bytesEsperados) {
        throw "Fallo de integridad SHA-256 en $archivoRel. Esperado: $esperado ($bytesEsperados bytes), Actual: $calculado ($($item.Length) bytes)"
    }
    Write-Host "  [SHA-256 OK] $archivoRel -> $calculado ($($item.Length) bytes)" -ForegroundColor Green
}

# 3. Ejecución de la suite automatizada de pruebas Frontend/Arquitectura (Vitest)
Write-Host "`n[3/4] Ejecutando suites automatizadas de pruebas (Vitest)..." -ForegroundColor Yellow
Push-Location (Join-Path $Raiz "frontend")
try {
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "La ejecucion de 'npm test' fallo con codigo de salida $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# 4. Auditoría dinámica en vivo con curl.exe -I (si se indicó $UrlObjetivo)
Write-Host "`n[4/4] Verificacion dinamica de cabeceras y transporte (Semanas 2, 5, 9 y 10)..." -ForegroundColor Yellow
$DinamicaEjecutada = $false
if ($UrlObjetivo -ne "") {
    Write-Host "  Consultando cabeceras en: $UrlObjetivo" -ForegroundColor Cyan
    $salidaCurl = & curl.exe -I -k -s $UrlObjetivo
    Write-Host $salidaCurl
    if ($salidaCurl -match "X-Content-Type-Options:\s*nosniff" -and $salidaCurl -match "X-Frame-Options:") {
        $DinamicaEjecutada = $true
        Write-Host "  [OK DINAMICO] Cabeceras defensivas verificadas en respuesta real." -ForegroundColor Green
    } else {
        Write-Host "  [ADVERTENCIA] La respuesta de $UrlObjetivo no incluyo todas las cabeceras esperadas." -ForegroundColor Yellow
    }
} else {
    Write-Host "  [PENDIENTE EN VIVO] No se proporciono -UrlObjetivo. Las pruebas de red en vivo" -ForegroundColor Yellow
    Write-Host "  (Nginx TLS, Nmap NSE, Apache Benchmark ab y equipamiento Cisco/WiFi) deben" -ForegroundColor Yellow
    Write-Host "  ejecutarse sobre el entorno Docker / Laboratorio siguiendo raspberry-pentest-playbook.md." -ForegroundColor Yellow
}

Write-Host "`n======================================================================" -ForegroundColor Cyan
if ($DinamicaEjecutada) {
    Write-Host " ESTADO: VERIFICACION ESTATICA, SHA-256, TESTS Y CABECERAS EN VIVO COMPLETADOS" -ForegroundColor Green
    Write-Host " Nota: Las pruebas de red fisica (VLANs/WPA3/RADIUS) y carga (Nmap/ab) requieren" -ForegroundColor Gray
    Write-Host "       evidencia de ejecucion en el laboratorio segun el playbook." -ForegroundColor Gray
} else {
    Write-Host " ESTADO: VERIFICACION LOCAL DE CODIGO, SHA-256 Y SUITES VITEST COMPLETADA" -ForegroundColor Green
    Write-Host "         VERIFICACION DINAMICA DE SERVIDOR/RED PENDIENTE DE EJECUCION EN VIVO" -ForegroundColor Yellow
}
Write-Host "======================================================================" -ForegroundColor Cyan

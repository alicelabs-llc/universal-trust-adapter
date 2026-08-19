# Script de deploy simultáneo para AI Profit Army
# Requiere: Git, Node.js (opcional)

param(
    [string]$CommitMessage = "Auto-deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Write-Host "🚀 Iniciando deploy multi-hosting..." -ForegroundColor Cyan

# 1. Verificar estado del repositorio
Write-Host "📦 Verificando repositorio Git..." -ForegroundColor Yellow
git status
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Error en git status. Asegúrate de estar en un repositorio Git."
    exit 1
}

# 2. Agregar cambios
Write-Host "📁 Agregando cambios..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Error al agregar cambios."
    exit 1
}

# 3. Commit
Write-Host "💾 Creando commit: $CommitMessage" -ForegroundColor Yellow
git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No hay cambios para commit o error." -ForegroundColor Yellow
}

# 4. Push a GitHub (dispara GitHub Actions)
Write-Host "📤 Push a GitHub..." -ForegroundColor Green
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Error en git push."
    exit 1
}

Write-Host "✅ Push completado. GitHub Actions desplegará a GitHub Pages." -ForegroundColor Green

# 5. Nota sobre Cloudflare Pages y Netlify
Write-Host "📝 Cloudflare Pages y Netlify se actualizarán automáticamente (si están conectados al repositorio)." -ForegroundColor Cyan
Write-Host "🔍 Verifica los deployments:" -ForegroundColor Cyan
Write-Host "   - GitHub Actions: https://github.com/[usuario]/[repositorio]/actions" -ForegroundColor Gray
Write-Host "   - Cloudflare Pages: https://dash.cloudflare.com/[account]/pages" -ForegroundColor Gray
Write-Host "   - Netlify: https://app.netlify.com/sites/[site]/deploys" -ForegroundColor Gray

# 6. Health check opcional
$runHealthCheck = Read-Host "¿Ejecutar health check? (y/n)"
if ($runHealthCheck -eq 'y') {
    Write-Host "🩺 Ejecutando health check..." -ForegroundColor Yellow
    node health-check.js
}

Write-Host "🎉 Proceso completado." -ForegroundColor Green
# Script de configuración inicial para Multi-Hosting Backup
# Este script guía al usuario a crear el repositorio GitHub y conectar los servicios.

Write-Host "🎯 CONFIGURACIÓN DE HOSTING GRATUITO MÚLTIPLE" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Write-Host "`n📦 Paso 1: Crear repositorio público en GitHub" -ForegroundColor Yellow
Write-Host "   - Ve a https://github.com/new" -ForegroundColor Gray
Write-Host "   - Nombre: ai-profit-army-landing (o el que prefieras)" -ForegroundColor Gray
Write-Host "   - Público" -ForegroundColor Gray
Write-Host "   - NO agregar README, .gitignore ni license (ya existen)" -ForegroundColor Gray
Write-Host "   - Click 'Create repository'" -ForegroundColor Gray

$repoUrl = Read-Host "   Introduce la URL del repositorio (ej: https://github.com/usuario/repositorio.git)"

Write-Host "`n🔗 Paso 2: Conectar repositorio local" -ForegroundColor Yellow
git remote add origin $repoUrl
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  El remote ya existe o hubo un error." -ForegroundColor Yellow
}

Write-Host "`n📤 Paso 3: Subir código a GitHub" -ForegroundColor Yellow
git branch -M main
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Error al hacer push. Verifica tus credenciales Git."
    exit 1
}

Write-Host "✅ Código subido a GitHub." -ForegroundColor Green

Write-Host "`n🌐 Paso 4: Configurar GitHub Pages" -ForegroundColor Yellow
Write-Host "   - Ve a Settings > Pages" -ForegroundColor Gray
Write-Host "   - Source: GitHub Actions" -ForegroundColor Gray
Write-Host "   - El workflow se ejecutará automáticamente." -ForegroundColor Gray
Write-Host "   - URL: https://[usuario].github.io/[repositorio]" -ForegroundColor Gray

Write-Host "`n☁️ Paso 5: Configurar Cloudflare Pages" -ForegroundColor Yellow
Write-Host "   - Ve a https://dash.cloudflare.com/?to=/:account/pages" -ForegroundColor Gray
Write-Host "   - Create a project > Connect to Git" -ForegroundColor Gray
Write-Host "   - Selecciona el repositorio" -ForegroundColor Gray
Write-Host "   - Build settings:" -ForegroundColor Gray
Write-Host "        Build command: (dejar vacío)" -ForegroundColor Gray
Write-Host "        Build output directory: ." -ForegroundColor Gray
Write-Host "   - Click 'Save and Deploy'" -ForegroundColor Gray

Write-Host "`n🚀 Paso 6: Configurar Netlify" -ForegroundColor Yellow
Write-Host "   - Ve a https://app.netlify.com/start" -ForegroundColor Gray
Write-Host "   - Import from Git > GitHub" -ForegroundColor Gray
Write-Host "   - Selecciona el repositorio" -ForegroundColor Gray
Write-Host "   - Build settings:" -ForegroundColor Gray
Write-Host "        Build command: (dejar vacío)" -ForegroundColor Gray
Write-Host "        Publish directory: ." -ForegroundColor Gray
Write-Host "   - Click 'Deploy site'" -ForegroundColor Gray

Write-Host "`n🔧 Paso 7: Configurar secrets para health checks" -ForegroundColor Yellow
Write-Host "   - Ve a GitHub repo > Settings > Secrets and variables > Actions" -ForegroundColor Gray
Write-Host "   - Agrega los siguientes secrets:" -ForegroundColor Gray
Write-Host "        GITHUB_PAGES_URL: URL de GitHub Pages" -ForegroundColor Gray
Write-Host "        CLOUDFLARE_PAGES_URL: URL de Cloudflare Pages" -ForegroundColor Gray
Write-Host "        NETLIFY_URL: URL de Netlify" -ForegroundColor Gray

Write-Host "`n🎉 Configuración completada!" -ForegroundColor Green
Write-Host "`n📊 URLs esperadas:" -ForegroundColor Cyan
Write-Host "   - GitHub Pages: https://[usuario].github.io/[repositorio]" -ForegroundColor Gray
Write-Host "   - Cloudflare Pages: https://[project].pages.dev" -ForegroundColor Gray
Write-Host "   - Netlify: https://[site].netlify.app" -ForegroundColor Gray

Write-Host "`n🚨 Para failover DNS:" -ForegroundColor Cyan
Write-Host "   - Configura múltiples registros A en tu DNS provider" -ForegroundColor Gray
Write-Host "   - O usa el script de failover incluido (failover.js)" -ForegroundColor Gray

Write-Host "`n📝 Más detalles en DEPLOY_GUIDE.md" -ForegroundColor Cyan
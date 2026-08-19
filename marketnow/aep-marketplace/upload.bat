@echo off
:: MarketNow — Upload Pipeline
:: Ejecutar desde D:\marketnow-repo-v2\
:: =============================================

echo.
echo ╔══════════════════════════════════════╗
echo ║   MarketNow — Skill Upload Pipeline  ║
echo ╚══════════════════════════════════════╝
echo.

cd /d D:\marketnow-repo-v2

:: 1. Copiar el scanner al repo si no está
if not exist scan_and_package.cjs (
  echo [ERROR] Falta scan_and_package.cjs en D:\marketnow-repo-v2\
  echo Copia el archivo primero.
  pause
  exit /b 1
)

:: 2. Escanear y generar catalog
echo [1/4] Escaneando D:\skills git\ ...
node scan_and_package.cjs
if errorlevel 1 (
  echo [ERROR] Falló el scanner.
  pause
  exit /b 1
)

:: 3. Verificar que se generaron los archivos
if not exist public\api\skills_index.json (
  echo [ERROR] No se generó skills_index.json
  pause
  exit /b 1
)
if not exist public\api\manifest.json (
  echo [ERROR] No se generó manifest.json
  pause
  exit /b 1
)

echo.
echo [2/4] Archivos generados:
for %%f in (public\api\*.json) do (
  echo    %%f  [%~z%%f bytes]
)

:: 4. Git add + commit + push
echo.
echo [3/4] Commiteando cambios...
git add public/api/
git add src/data/ 2>nul
git status --short

set TIMESTAMP=%date:~6,4%-%date:~3,2%-%date:~0,2%
git commit -m "feat: update skill catalog %TIMESTAMP% [%RANDOM% skills]"
if errorlevel 1 (
  echo [WARN] Nada que commitear o error en commit.
)

echo.
echo [4/4] Pushing a GitHub (auto-deploy Cloudflare)...
git push origin master
if errorlevel 1 (
  echo [ERROR] Falló el push. Verifica credenciales de git.
  pause
  exit /b 1
)

echo.
echo ✅ Pipeline completo!
echo    Cloudflare auto-deploy arrancará en ~1 min.
echo    Verifica en: https://dash.cloudflare.com → Pages → marketnow
echo.
echo    API live en:
echo    https://www.marketnow.site/api/manifest.json
echo    https://www.marketnow.site/api/skills_index.json
echo    https://www.marketnow.site/api/categories.json
echo.
pause

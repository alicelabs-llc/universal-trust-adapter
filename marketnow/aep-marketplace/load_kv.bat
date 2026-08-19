@echo off
:: MarketNow — Carga el índice de skills a Cloudflare KV
:: Ejecutar DESPUÉS de upload.bat (cuando el deploy ya terminó)
:: =============================================================

echo.
echo ╔══════════════════════════════════════╗
echo ║  MarketNow — Carga KV para búsqueda ║
echo ╚══════════════════════════════════════╝
echo.

cd /d D:\marketnow-repo-v2

:: Verificar que wrangler esté instalado
where wrangler >nul 2>&1
if errorlevel 1 (
  echo Instalando wrangler...
  npm install -g wrangler
)

:: Verificar que el índice existe
if not exist public\api\skills_index.json (
  echo [ERROR] No existe public\api\skills_index.json
  echo Ejecuta upload.bat primero.
  pause
  exit /b 1
)

echo [1/3] Subiendo skills_index.json a KV...
wrangler kv:key put "skills_index_v2" --path public\api\skills_index.json --binding SKILLS_KV
if errorlevel 1 (
  echo [ERROR] Falló la carga a KV.
  echo Asegúrate de haber corrido: wrangler kv:namespace create SKILLS_KV
  echo Y de haber puesto el ID en wrangler.toml
  pause
  exit /b 1
)

echo [2/3] Subiendo categories.json a KV...
wrangler kv:key put "categories_v2" --path public\api\categories.json --binding SKILLS_KV

echo [3/3] Verificando Worker...
curl -s https://www.marketnow.site/api/health
echo.

echo.
echo ✅ KV cargado!
echo    Prueba búsqueda: https://www.marketnow.site/api/search?q=ableton
echo    Prueba categoría: https://www.marketnow.site/api/search?cat=Media
echo    Prueba lenguaje: https://www.marketnow.site/api/search?lang=python
echo.
pause

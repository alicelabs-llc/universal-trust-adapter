# Guía de Despliegue Multi-Hosting - AI Profit Army

Esta guía describe cómo desplegar las landing pages de AI Profit Army en 3 hosts gratuitos simultáneamente (GitHub Pages, Cloudflare Pages, Netlify) y configurar un sistema de failover.

## 🚀 Pasos Rápidos

### 1. GitHub Pages Setup
1. **Crear repositorio público** en GitHub (ej: `ai-profit-army-landing`).
2. **Subir los archivos**:
   ```bash
   git remote add origin https://github.com/[usuario]/[repositorio].git
   git branch -M main
   git push -u origin main
   ```
3. **Habilitar GitHub Pages**:
   - Ir a Settings > Pages
   - Source: `GitHub Actions`
   - El workflow `.github/workflows/deploy.yml` se ejecutará automáticamente.
4. **URL resultante**: `https://[usuario].github.io/[repositorio]`

### 2. Cloudflare Pages Setup
1. **Ir a Cloudflare Dashboard** > Pages > Create a project.
2. **Conectar repositorio GitHub** (autorizar).
3. **Configurar build settings**:
   - Build command: (dejar vacío)
   - Build output directory: `.`
4. **Despliegue automático** en cada push.
5. **URL resultante**: `https://[project].pages.dev`

### 3. Netlify Backup
1. **Ir a Netlify Dashboard** > Add new site > Import from Git.
2. **Conectar repositorio GitHub**.
3. **Configurar deploy settings**:
   - Build command: (dejar vacío)
   - Publish directory: `.`
4. **Despliegue automático**.
5. **URL resultante**: `https://[site].netlify.app`

## 🔄 Sistema de Failover

### Opción A: DNS con múltiples registros A (Cloudflare)
1. **Configurar dominio** (ej: `aiprofitarmy.com`) en Cloudflare DNS.
2. **Agregar múltiples registros A**:
   ```
   @   A   185.199.108.153   (GitHub Pages)
   @   A   185.199.109.153
   @   A   185.199.110.153
   @   A   185.199.111.153
   ```
   Y también registros para Cloudflare Pages y Netlify (consultar sus IPs).
3. **Habilitar Health Checks** en Cloudflare (Enterprise) o usar Load Balancing.

### Opción B: Redirección con JavaScript (simple)
Incluir script `failover.js` en cada página que redirija si el host principal cae.

### Opción C: UptimeRobot + redirección
1. Crear monitors en UptimeRobot para cada URL.
2. Configurar alerta webhook que active un script de redirección.

## 📊 Monitoreo de Uptime

Se incluye un workflow de GitHub Actions (`health-check.yml`) que verifica cada 30 minutos el estado de los 3 hosts.

**Configurar secrets en GitHub**:
- `GITHUB_PAGES_URL`: URL de GitHub Pages
- `CLOUDFLARE_PAGES_URL`: URL de Cloudflare Pages
- `NETLIFY_URL`: URL de Netlify

## 🛠️ Scripts de Automatización

- `deploy-all.ps1`: Script PowerShell para deploy simultáneo.
- `health-check.js`: Verificación manual de hosts.

## 🚨 Migración Rápida

Si un hosting cae:
1. **Actualizar DNS**: Cambiar registros A al host activo.
2. **Redirigir tráfico**: Usar script de failover.
3. **Notificar**: Usar el sistema de notificaciones del health check.

## 📞 Soporte

Para problemas:
1. Revisar logs de GitHub Actions.
2. Verificar configuraciones de build.
3. Confirmar que los archivos estáticos sean accesibles.

---

**Estado**: 3 URLs funcionando + sistema de failover configurable.
# AI Profit Army 🚀

Landing page para herramientas de Inteligencia Artificial que generan ingresos sin depender de publicidad.

## 🎯 Objetivo

Mostrar las mejores herramientas open-source de IA para monetización, con estrategias prácticas y casos de uso reales.

## 🛠️ Herramientas Incluidas

1. **AutoGPT** - Agentes autónomos para automatización de negocios
2. **Stable Diffusion WebUI** - Generación de imágenes comerciales
3. **n8n / Activepieces** - Automatización open-source (alternativa Zapier)
4. **OpenClaw + Hooks** - Sistema de automatización personalizado
5. **Browser Automation + AI** - Scraping inteligente y automatización web

## 💰 Estrategias de Monetización

- **Servicios B2B de Automatización**: $500-$2000/mes por cliente
- **Contenido Generado por IA**: Venta en marketplaces (Etsy, Shutterstock)
- **SaaS Automatizado con AutoGPT**: Suscripciones $50-$500/mes
- **Browser Automation + AI**: Servicios de scraping inteligente

## 🚀 Despliegue

### Opción 1: Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel
```

O simplemente arrastra la carpeta a [Vercel](https://vercel.com/new)

### Opción 2: GitHub Pages

1. Haz fork de este repositorio
2. Activa GitHub Pages en Settings > Pages
3. Selecciona la rama main y carpeta /docs o root

### 🛡️ Multi-Hosting Setup (Backup Redundante)

Para máxima disponibilidad, hemos configurado despliegue simultáneo en 3 hosts gratuitos:

1. **GitHub Pages** - Auto-deploy con GitHub Actions
2. **Cloudflare Pages** - Edge deployment con funciones serverless
3. **Netlify** - Backup con forms gratis y redirects

**Beneficios**:
- 99.9% uptime con failover automático
- Despliegue automático en cada push
- Costo cero (free tier)

**Configuración completa**: Ver [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) para instrucciones detalladas.

## 📁 Estructura del Proyecto

```
landing-ai-profit-army/
├── index.html                 # Página principal
├── blog.html                  # Blog
├── catalogo.html              # Catálogo de herramientas
├── checkout.html              # Checkout
├── dashboard.html             # Dashboard
├── landing-ecommerce.html     # Landing ecommerce
├── landing-marketing.html     # Landing marketing
├── testimonios.html           # Testimonios
├── styles.css                 # Estilos CSS
├── script.js                  # Scripts comunes
├── vercel.json                # Configuración de Vercel
├── netlify.toml               # Configuración de Netlify
├── cf-pages.json              # Configuración de Cloudflare Pages
├── health-check.js            # Script de verificación de hosts
├── failover.js                # Script de redirección automática
├── deploy-all.ps1             # Script de deploy simultáneo
├── .github/workflows/         # GitHub Actions
│   ├── deploy.yml             # Auto-deploy a GitHub Pages
│   └── health-check.yml       # Monitoreo de uptime
├── functions/                 # Cloudflare Edge Functions
│   └── _middleware.js         # Middleware para forms
└── README.md                  # Documentación
```

## 🔧 Personalización

1. Edita los archivos HTML para cambiar colores, textos o añadir más herramientas
2. Modifica `vercel.json` para configurar dominio personalizado
3. Añade imágenes en la carpeta `assets/` (crear si no existe)

## ⚡ Sistema de Failover

Incluye tres capas de redundancia:

1. **DNS Failover**: Configurar múltiples registros A en Cloudflare DNS
2. **Health Checks**: Monitoreo automático cada 30 minutos (GitHub Actions)
3. **Client-side Redirection**: Script `failover.js` redirige automáticamente si un host cae

Para configurar el failover, ver la guía detallada en [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md).

## 📊 Monitoreo de Uptime

El workflow `health-check.yml` verifica cada 30 minutos el estado de los 3 hosts y crea un issue en GitHub si alguno falla.

**URLs de monitoreo**:
- GitHub Actions: `https://github.com/[usuario]/[repositorio]/actions`
- Cloudflare Analytics: Dashboard de Pages
- Netlify Analytics: Dashboard del sitio

## 🔄 Despliegue Automático

Para desplegar en los 3 hosts simultáneamente:

```powershell
# Ejecutar desde PowerShell en la carpeta del proyecto
.\deploy-all.ps1
```

O simplemente hacer push a la rama main (dispara los webhooks).

## 📊 Integraciones Futuras

- [ ] Dashboard de seguimiento de herramientas
- [ ] Ejemplos de flujos de n8n
- [ ] Tutoriales de AutoGPT
- [ ] API para análisis de herramientas

## 👥 Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-herramienta`)
3. Commit cambios (`git commit -am 'Añade nueva herramienta'`)
4. Push a la rama (`git push origin feature/nueva-herramienta`)
5. Abre un Pull Request

## 📄 Licencia

MIT - Libre uso y modificación.

---

**Creado con ❤️ usando OpenClaw** • [Ver página en vivo](https://ai-profit-army.vercel.app)

**Estado Multi-Hosting**: ✅ Configuración completa lista para 3 hosts gratuitos + sistema de failover.
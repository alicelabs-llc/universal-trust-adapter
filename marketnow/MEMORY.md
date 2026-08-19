# MEMORY.md - Memoria a Largo Plazo

## Sistema
- **Primera sesión**: 2026-02-10
- **Idioma**: Español | **Zona horaria**: GMT-5
- **Nombre agente**: Thomas | **Rol**: Compañero de trabajo

## Usuario
- Prefiere productos tangibles (apps, programas) sobre cursos
- LLC disponible para ventas formales
- Prefiere un solo hilo hasta completarlo, sin divagaciones
- Modelo preferido: deepseek-chat (no reasoner)

## Proyectos Activos
1. **AI Profit Army**: Landing en Vercel + 36 workflows n8n comerciales
2. **Apps Play Store**: 5 apps en desarrollo (Invoice Scanner, Budget Planner, etc.)
3. **WhatsApp Automation**: Sistema en `.openclaw/whatsapp-automation`, puerto 3000
4. **Programas Desktop**: 10-15 en análisis

## Infraestructura
- **n8n**: localhost:5678 (user: support@alicelabs.site)
- **GitHub**: eddyflores100-lang
- **Almacenamiento**: D:\ trabajo activo, C:\ cache, E:\ archivo

## Lecciones Clave
- APIs free con rate limits causan errores en cascada → usar solo proveedores confiables
- GitHub Push Protection bloquea tokens → usar `[REMOVED_FOR_GITHUB_PUSH]`
- SSH > HTTPS para push/pull frecuentes
- PowerShell + System.Net.Http óptimo para APIs en Windows
- Sub-agents pueden fallar en cascada → validar credenciales antes de lanzar tareas masivas
- Transparencia crítica: mostrar archivos y configs reales, no inventar
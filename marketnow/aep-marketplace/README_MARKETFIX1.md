# MarketNow — Sistema de Upload y Búsqueda

## Archivos incluidos

| Archivo | Función |
|---------|---------|
| `scan_and_package.cjs` | Escanea `D:\skills git\`, extrae metadata, genera catalog |
| `upload.bat` | Corre el scanner y hace git push (auto-deploy Cloudflare) |
| `workers/search.js` | Cloudflare Worker para búsqueda server-side y registro |
| `wrangler.toml` | Configuración del Worker y KV |
| `load_kv.bat` | Carga el índice a Cloudflare KV para búsqueda rápida |

---

## Paso a paso

### 1. Copiar archivos al repo

```
D:\marketnow-repo-v2\
├── scan_and_package.cjs    ← copiar aquí
├── upload.bat              ← copiar aquí
├── wrangler.toml           ← copiar aquí
├── load_kv.bat             ← copiar aquí
└── workers\
    └── search.js           ← copiar aquí
```

### 2. Crear KV Namespace en Cloudflare

```bash
cd D:\marketnow-repo-v2
npm install -g wrangler
wrangler login
wrangler kv:namespace create "SKILLS_KV"
```

Copia el `id` que devuelve y pégalo en `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "SKILLS_KV"
id      = "abc123..."   ← pegar aquí
```

### 3. Deploy del Worker

```bash
wrangler deploy
```

### 4. Escanear y subir skills

```bat
upload.bat
```

Esto hace:
- Escanea `D:\skills git\` (~13,860 repos)
- Extrae metadata (README, lang, tags, categoría)
- Genera `public/api/skills_index.json` + archivos por categoría
- Git push → Cloudflare auto-deploy

### 5. Cargar KV para búsqueda

```bat
load_kv.bat
```

---

## API resultante

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/manifest.json` | Info del marketplace |
| `GET /api/skills_index.json` | Índice completo (ligero) |
| `GET /api/categories.json` | Lista de categorías con conteo |
| `GET /api/skills/{cat}.json` | Skills completas por categoría |
| `GET /api/search?q=ableton` | Búsqueda server-side (Worker) |
| `GET /api/search?cat=Finance&lang=python` | Filtros combinados |
| `GET /api/search?verified=true&limit=10` | Solo verificadas |
| `POST /api/register` | Registro de nueva skill |

### Ejemplo de búsqueda

```bash
curl "https://www.marketnow.site/api/search?q=music&lang=python&limit=5"
```

```json
{
  "total": 23,
  "limit": 5,
  "offset": 0,
  "count": 5,
  "results": [
    {
      "id": "mn-00042-ableton-mcp",
      "name": "Ableton MCP",
      "shortDesc": "Control Ableton Live with AI agents",
      "category": "Media",
      "lang": "python",
      "tags": ["media", "python", "stdio"],
      "verified": true,
      "install": "uvx ableton-mcp"
    }
  ]
}
```

### Ejemplo de registro

```bash
curl -X POST https://www.marketnow.site/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Skill",
    "description": "Does amazing things",
    "repoUrl": "https://github.com/user/my-skill",
    "email": "dev@example.com",
    "category": "Automation",
    "lang": "typescript",
    "install": "npx -y my-skill-mcp"
  }'
```

---

## Estimación de tamaño

Con 13,860 skills:
- `skills_index.json` → ~8-12 MB (sin pretty-print)
- Archivos por categoría → ~0.5-2 MB cada uno
- **Total estimado: ~50-80 MB** (bien dentro de los 10 GB de Cloudflare Pages)

## Próximos pasos opcionales

- Agregar panel de admin para aprobar/rechazar submissions (`/api/admin/pending`)
- Generar página estática por skill para SEO (`/skills/{slug}.html`)
- Webhook de notificación cuando llega un nuevo registro

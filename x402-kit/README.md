# UTA x402 Paywall Kit — Vende verificación de confianza ATC/1.0 por llamada (USDC)

Este kit convierte el **Universal Trust Adapter (ATC/1.0)** en un **producto medible**:
endpoints HTTP pagados por llamada vía **x402** (HTTP 402 + stablecoins). Sin contratos,
sin facturación, sin cuentas: cualquier agente que necesite verificar la confianza de
otro agente **paga por request** y queda listado en x402scan.com al recibir tráfico.

> **v2 (seguro):** el servidor FastAPI usa el middleware oficial `x402` (v2.25) con
> **verify + settle reales contra el facilitador**. Probado fail-closed:
> sin header → `402`; header falso → `402` (nunca `200` sin liquidación).

## Qué se vende

| Endpoint | Precio (USDC) | Qué entrega |
|---|---|---|
| `POST /v1/trust/verify` | $0.01 | Verificación Ed25519 de Agent Trust Card + score de riesgo |
| `POST /v1/trust/batch` | $0.08 | Hasta 10 tarjetas por llamada (marketplaces con escrow) |
| `GET /v1/card/:did` | gratis | Lectura pública (funnel + SEO de protocolo) |
| `GET /health` | gratis | Estado y precios del servicio |

**Case de venta:** RentAHuman.ai y dealwork.ai fondean escrow entre agentes sin verificación
de contraparte. UTA es el *Know-Your-Agent* que falta: se integra delante del escrow.

## Wallet de tesorería (testnet activa)

- Dirección `PAY_TO` de AliceLabs: `0xfD856E89Ac88757C339c67E9717528af0cD1d7Ee`
- Red inicial: `base-sepolia` (testnet). Faucet USDC: https://faucet.circle.com / https://www.alchemy.com/faucets/base-sepolia

## Instalación (FastAPI — recomendado, seguro)

```bash
pip install "x402[fastapi,httpx,evm]" fastapi uvicorn
export PAY_TO="0xfD856E89Ac88757C339c67E9717528af0cD1d7Ee"
export NETWORK="base-sepolia"          # luego: base (mainnet)
uvicorn fastapi.fastapi_server:app --port 4020
```

`agent-trust-card` (Python) es opcional: si no está instalado, el servicio responde
con `note` en vez de fallar (fallback de desarrollo).

## Instalación (Express/Node)

```bash
npm install @x402/core @x402/evm @x402/express express
node express/server.js   # paymentMiddleware oficial @x402/express
```

## Deploy one-click

- **Render**: New → Web Service → Docker → variables `PAY_TO`, `NETWORK` → deploy.
  (`render.yaml` incluido: blueprint).
- **Railway / Fly.io / Cloudflare Run**: mismo Dockerfile, mismas 2 variables.
- **Local**: `docker compose up` o `uvicorn` directo.

## Checklist de producción

- [x] Contrato 402 probado (sin pago → 402; pago falso → 402; nunca 200 sin settle)
- [x] Wallet de tesorería generada (clave en secret store local, 0600)
- [ ] Deploy en host permanente (Render/Railway/Fly free tier) — testnet
- [ ] 1ª llamada real con USDC testnet → aparición en x402scan.com
- [ ] Migrar a `base` mainnet con monto real
- [ ] Pitch B2B a RentAHuman / dealwork (KYA pre-escrow)

## Referencias

- x402 Foundation: https://github.com/x402-foundation/x402 — paquetes `@x402/*` (TS) y `pip install "x402[fastapi]"` (Python v2.25: `payment_middleware` en `x402.http.middleware.fastapi`, `HTTPFacilitatorClient(config={"url": ...})`)
- Explorador en vivo: https://x402scan.com
- AP2 (Google) demuestra el flujo autónomo con x402: https://ap2-protocol.org
- Especificación ATC/1.0: este repo (`spec/`)

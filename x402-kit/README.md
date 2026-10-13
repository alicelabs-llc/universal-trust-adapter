# UTA x402 Paywall Kit — Vende verificación de confianza ATC/1.0 por llamada (USDC)

Este kit convierte el **Universal Trust Adapter (ATC/1.0)** en un **producto medible**:
endpoints HTTP pagados por llamada vía **x402** (HTTP 402 + stablecoins). Sin contratos,
sin facturación, sin cuentas: cualquier agente que necesite verificar la confianza de
otro agente **paga por request** y queda listado en x402scan.com al recibir tráfico.

## Qué se vende

| Endpoint | Precio sugerido (USDC) | Qué entrega |
|---|---|---|
| `POST /v1/trust/verify` | $0.01 | Verificación Ed25519 de un Agent Trust Card + score de riesgo |
| `POST /v1/trust/batch` | $0.08 | Hasta 10 tarjetas por llamada (para marketplaces con escrow) |
| `GET /v1/card/:did` | gratis | Lectura pública de tarjeta (funnel + SEO de protocolo) |
| `GET /health` | gratis | Estado del servicio |

**Case de venta:** RentAHuman.ai y dealwork.ai fondean escrow entre agentes sin verificación
de contraparte. UTA es el *Know-Your-Agent* que falta: se integra delante del escrow.

## Instalación (servidor Express)

```bash
npm install @x402/core @x402/evm @x402/express express
npm install agent-trust-card        # paquete npm oficial de UTA
node express/server.js
```

## Instalación (servidor FastAPI / Python)

```bash
pip install x402 fastapi uvicorn agent-trust-card
uvicorn fastapi.server:app --port 4020
```

## Configuración mínima

```bash
export PAY_TO="0xTU_DIRECCION_EVM"          # recibe USDC
export NETWORK="base-sepolia"               # testnet primero, luego "base"
export FACILITATOR="https://x402.org/facilitator"  # facilitador público
```

## checklist de producción

- [ ] Probar en `base-sepolia` (testnet) hasta validar el flujo completo de pago.
- [ ] Pasar a `base` mainnet con monto real y wallet de tesorería.
- [ ] Generar tráfico semilla (1 llamada = aparición en x402scan.com).
- [ ] Publicar el endpoint en docs de ATC/1.0 y en el README principal de UTA.
- [ ] Ofrecer integración directa a RentAHuman / dealwork (pitch en SELL_KIT interno).

## Referencias

- x402 Foundation: https://github.com/x402-foundation/x402 (paquetes `@x402/express`, `pip install x402`)
- Explorador en vivo: https://x402scan.com
- AP2 (Google) demuestra el flujo autónomo con x402: https://ap2-protocol.org
- Especificación ATC/1.0: este repo (`spec/`)

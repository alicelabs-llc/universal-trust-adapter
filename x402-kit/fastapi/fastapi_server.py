"""
UTA x402 Paywall — servidor FastAPI de referencia (ATC/1.0, Python) v2
SECURE: usa el middleware oficial de x402 (verify+settle real vía facilitador).
Sin pago válido NO hay respuesta 200 — fail-closed probado (header fake => 402).

pip install "x402[fastapi,httpx,evm]" fastapi uvicorn agent-trust-card
uvicorn fastapi_server:app --port 4020
"""
import os

from fastapi import FastAPI, Request
from pydantic import BaseModel

from x402 import x402ResourceServer
from x402.http import HTTPFacilitatorClient
from x402.http.middleware.fastapi import payment_middleware  # v2.25: no re-exportado en __init__
from x402.mechanisms.evm.exact import ExactEvmServerScheme

try:
    from agent_trust_card import verify_agent_trust_card  # paquete oficial UTA
except Exception:  # pragma: no cover — fallback de desarrollo
    async def verify_agent_trust_card(card: dict):
        return {"valid": False, "risk": None, "note": "agent-trust-card not installed"}

PAY_TO = os.environ.get("PAY_TO", "0x0000000000000000000000000000000000000000")
NETWORK = os.environ.get("NETWORK", "base-sepolia")  # base | base-sepolia
FACILITATOR = os.environ.get("FACILITATOR", "https://x402.org/facilitator")

CAIP2 = {"base": "eip155:8453", "base-sepolia": "eip155:84532"}.get(NETWORK, "eip155:84532")

# --- Servidor de recursos x402 (verify + settle reales) ---
facilitator = HTTPFacilitatorClient(config={"url": FACILITATOR})
server = x402ResourceServer(facilitator)
server.register("eip155:*", ExactEvmServerScheme())
server.initialize()

# --- Rutas protegidas: precio por llamada ---
ROUTES = {
    "POST /v1/trust/verify": {
        "accepts": {"scheme": "exact", "payTo": PAY_TO, "price": "$0.01", "network": CAIP2},
        "description": "UTA ATC/1.0: verificacion Ed25519 de Agent Trust Card + score de riesgo",
    },
    "POST /v1/trust/batch": {
        "accepts": {"scheme": "exact", "payTo": PAY_TO, "price": "$0.08", "network": CAIP2},
        "description": "UTA ATC/1.0: verificacion por lote (hasta 10 tarjetas) para escrow de marketplaces",
    },
}

app = FastAPI(title="UTA ATC/1.0 Trust API", version="2.0.0",
              description="Verificacion de confianza para agentes, cobrada por llamada via x402")


@app.middleware("http")
async def x402_paywall(request: Request, call_next):
    """402 sin pago; verify+settle contra facilitador; nunca 200 sin liquidacion."""
    return await payment_middleware(ROUTES, server)(request, call_next)


class CardRequest(BaseModel):
    card: dict


class BatchRequest(BaseModel):
    cards: list[dict]


@app.get("/health")
def health():
    """Gratis: estado del servicio (funnel)."""
    return {"ok": True, "protocol": "ATC/1.0", "rail": "x402", "network": NETWORK,
            "price_verify_usdc": 0.01, "price_batch_usdc": 0.08}


@app.get("/v1/card/{did}")
def read_card(did: str):
    """Gratis: lectura publica de tarjeta (funnel del protocolo)."""
    return {"did": did, "found": False, "note": "public card index pending"}


@app.post("/v1/trust/verify")
async def trust_verify(request: Request, body: CardRequest):
    """Pagada ($0.01): el middleware ya liquido el pago => request.state.payment_payload."""
    payer = getattr(request.state, "payment_payload", None)
    payer_addr = getattr(getattr(payer, "accepted", None), "payTo", None)
    result = await verify_agent_trust_card(body.card)
    return {"protocol": "ATC/1.0", "verified": result.get("valid", False),
            "risk": result.get("risk"), "payer": payer_addr, "detail": result}


@app.post("/v1/trust/batch")
async def trust_batch(request: Request, body: BatchRequest):
    """Pagada ($0.08): hasta 10 tarjetas (caso escrow en marketplaces de agentes)."""
    if len(body.cards) == 0 or len(body.cards) > 10:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="cards: 1..10 required")
    payer = getattr(request.state, "payment_payload", None)
    payer_addr = getattr(getattr(payer, "accepted", None), "payTo", None)
    results = []
    for card in body.cards:
        r = await verify_agent_trust_card(card)
        results.append({"did": card.get("did"), "verified": r.get("valid", False),
                        "risk": r.get("risk")})
    return {"protocol": "ATC/1.0", "count": len(results), "payer": payer_addr, "results": results}

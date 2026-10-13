"""
UTA x402 Paywall — servidor FastAPI de referencia (ATC/1.0, Python)

Vende verificación de confianza por llamada vía x402.
Basado en el SDK oficial python (`pip install x402`).

pip install x402 fastapi uvicorn agent-trust-card
uvicorn fastapi_server:app --port 4020
"""
import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

try:
    from agent_trust_card import verify_agent_trust_card  # paquete oficial UTA
except Exception:  # pragma: no cover - fallback para desarrollo sin el paquete
    async def verify_agent_trust_card(card: dict):
        return {"valid": False, "risk": None, "note": "agent-trust-card not installed"}

PAY_TO = os.environ.get("PAY_TO", "0x0000000000000000000000000000000000000000")
NETWORK = os.environ.get("NETWORK", "base-sepolia")
FACILITATOR = os.environ.get("FACILITATOR", "https://x402.org/facilitator")

app = FastAPI(title="UTA ATC/1.0 Trust API", version="1.0.0",
              description="Verificacion de confianza para agentes, pagada por llamada via x402")


class CardRequest(BaseModel):
    card: dict


class BatchRequest(BaseModel):
    cards: List[dict]


@app.get("/health")
def health():
    return {"ok": True, "protocol": "ATC/1.0", "rail": "x402", "network": NETWORK}


@app.get("/v1/card/{did}")
def read_card(did: str):
    """Lectura publica (gratis) - funnel del protocolo."""
    return {"did": did, "found": False, "note": "public card index pending"}


@app.post("/v1/trust/verify")
async def trust_verify(req: Request, body: CardRequest):
    """$0.01/call — x402 exige el header X-PAYMENT; si falta, responde 402 con requisitos."""
    payment_header = req.headers.get("x-payment")
    if not payment_header:
        raise HTTPException(
            status_code=402,
            detail={
                "x402Version": 1,
                "error": "X-PAYMENT header required",
                "accepts": [{
                    "scheme": "exact",
                    "network": NETWORK,
                    "maxAmountRequired": "10000",  # $0.01 USDC (6 decimales)
                    "payTo": PAY_TO,
                    "resource": "POST /v1/trust/verify",
                    "description": "UTA: verificacion Ed25519 de Agent Trust Card (ATC/1.0)",
                    "mimeType": "application/json",
                    "maxTimeoutSeconds": 30,
                    "extra": {"facilitator": FACILITATOR, "name": "USDC", "version": 2},
                }],
            },
        )
    # Con facilitador completo: validar el settlement antes de responder.
    # Referencia: https://github.com/x402-foundation/x402/tree/main/python
    result = await verify_agent_trust_card(body.card)
    return {"protocol": "ATC/1.0", "verified": result.get("valid", False),
            "risk": result.get("risk"), "detail": result}


@app.post("/v1/trust/batch")
async def trust_batch(req: Request, body: BatchRequest):
    """$0.08/call — hasta 10 tarjetas (caso de uso: escrow en marketplaces de agentes)."""
    payment_header = req.headers.get("x-payment")
    if not payment_header:
        raise HTTPException(status_code=402, detail={"error": "X-PAYMENT header required",
                                                     "price_usdc": "0.08"})
    if len(body.cards) == 0 or len(body.cards) > 10:
        raise HTTPException(status_code=400, detail="cards: 1..10 required")
    results = []
    for card in body.cards:
        r = await verify_agent_trust_card(card)
        results.append({"did": card.get("did"), "verified": r.get("valid", False),
                        "risk": r.get("risk")})
    return {"protocol": "ATC/1.0", "count": len(results), "results": results}

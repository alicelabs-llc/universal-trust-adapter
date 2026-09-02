r"""
langchain-uta-middleware — Verify LangChain tool calls with UTA (fail-closed).

LangChain rejected core integration twice (#40100/#40102, bot-closed). This
adapter needs ZERO LangChain changes: it wraps any tool in a Runnable that
verifies the UTA trust card before invoking the wrapped tool.

Usage:
    from langchain_uta_middleware import uta_verified
    safe_tool = uta_verified(my_tool, trust_credential=card)

Status: POC (v0.1.0). License: AliceLabs Source-Available License v1.0 (AL-1.0).
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

VERIFY_URL = os.environ.get(
    "UTA_VERIFY_URL",
    "https://www.marketnow.site/api/trust?action=verify",
)
TIMEOUT = float(os.environ.get("UTA_VERIFY_TIMEOUT", "5"))


class UTADenied(RuntimeError):
    """Tool call denied by UTA (fail-closed)."""


def verify_with_uta(payload: Dict[str, Any]) -> Dict[str, Any]:
    req_data = json.dumps({"payload": payload}).encode("utf-8")
    req = urllib_request(VERIFY_URL, req_data)
    try:
        import urllib.request as ur
        with ur.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 — fail-closed
        raise UTADenied(f"UTA unreachable: {exc}") from exc


def urllib_request(url: str, data: bytes):
    import urllib.request as ur
    return ur.Request(url, data=data,
                      headers={"Content-Type": "application/json"}, method="POST")


def uta_verified(tool: Any, trust_credential: Optional[Dict[str, Any]] = None,
                 min_trust_score: int = 70) -> Any:
    """Wrap a LangChain tool (Runnable) with UTA verification."""
    try:
        from langchain_core.runnables import RunnableLambda
    except ImportError as exc:
        raise ImportError("pip install langchain-core to use this adapter") from exc

    def _guarded(inp: Any) -> Any:
        if not trust_credential:
            raise UTADenied("no trust credential provided")
        result = verify_with_uta(trust_credential)
        if not result.get("valid"):
            raise UTADenied(f"invalid trust card: {result.get('warnings')}")
        score = (result.get("uts") or {}).get("trust", {}).get("score", 0)
        if score < min_trust_score:
            raise UTADenied(f"trust score {score} < {min_trust_score}")
        return tool.invoke(inp)

    return RunnableLambda(_guarded, name=f"uta_{getattr(tool, 'name', 'tool')}")


if __name__ == "__main__":
    try:
        print(verify_with_uta({"probe": "langchain-uta-middleware smoke test"}))
    except UTADenied as exc:
        print("DENIED (fail-closed):", exc)

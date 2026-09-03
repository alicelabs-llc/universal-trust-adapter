r"""
openai-agents-uta-hooks — UTA trust verification for the OpenAI Agents SDK.

OpenAI declined core integration (#4806: "this repo tracks bugs and feature
requests for the SDK itself"). This adapter uses ONLY the public RunHooks API:
`on_tool_start` runs before every tool call and can deny it.

Fail-closed: any verification failure denies the tool call.

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
    import urllib.request as ur
    req = ur.Request(
        VERIFY_URL,
        data=json.dumps({"payload": payload}).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with ur.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 — fail-closed
        raise UTADenied(f"UTA unreachable: {exc}") from exc


def build_uta_hooks(trust_credential: Optional[Dict[str, Any]] = None,
                    min_trust_score: int = 70) -> Any:
    """Return a RunHooks instance that denies unverified tool calls."""
    try:
        from agents import RunHooks, ToolCallApproval  # Agents SDK
    except ImportError:
        try:
            from openai.agents import RunHooks  # alt import path
        except ImportError:
            raise ImportError("pip install openai-agents to use this adapter")

    class UTAHooks(RunHooks):
        async def on_tool_start(self, context, agent, tool, **kwargs):
            if not trust_credential:
                raise UTADenied("no trust credential provided")
            result = verify_with_uta(trust_credential)
            if not result.get("valid"):
                raise UTADenied(f"invalid trust card: {result.get('warnings')}")
            score = (result.get("uts") or {}).get("trust", {}).get("score", 0)
            if score < min_trust_score:
                raise UTADenied(f"trust score {score} < {min_trust_score}")

    return UTAHooks()


if __name__ == "__main__":
    try:
        print(verify_with_uta({"probe": "openai-agents-uta-hooks smoke test"}))
    except UTADenied as exc:
        print("DENIED (fail-closed):", exc)

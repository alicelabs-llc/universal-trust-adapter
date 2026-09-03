r"""
anthropic-uta-guard — UTA trust gate for Anthropic SDK tool use (fail-closed).

Background: anthropic-sdk-python#1904 was closed as not_planned — the SDK repo
tracks SDK bugs, not ecosystem extensions. Respect that boundary: this guard
lives in OUR repository and wraps the SDK from the outside. Zero Anthropic
code is changed, no PRs required.

Pattern: intercept the model's tool_use blocks BEFORE executing them.
Each tool call is verified against UTA with the agent's trust card.
Decision is fail-closed: verification error => tool call DENIED.

Usage:
    from anthropic_uta_guard import verify_tool_use, UTAGuardError

    for block in response.content:
        if block.type == "tool_use":
            verdict = verify_tool_use(block.name, block.input, TRUST_CARD)
            if verdict["decision"] == "DENY":
                # feed the refusal back to the model as tool_result
                ...

Set UTA_VERIFY_URL to point at another UTA instance (default: public endpoint).

Status: POC (v0.1.0). License: AliceLabs Source-Available License v1.0 (AL-1.0).
"""
from __future__ import annotations

import os
from typing import Any, Dict

VERIFY_URL = os.environ.get(
    "UTA_VERIFY_URL",
    "https://www.marketnow.site/api/trust?action=verify",
)
TIMEOUT = float(os.environ.get("UTA_VERIFY_TIMEOUT", "5"))


class UTAGuardError(RuntimeError):
    """Raised when UTA cannot verify (fail-closed path)."""


def verify_tool_use(
    tool_name: str,
    tool_input: Dict[str, Any],
    trust_card: Dict[str, Any],
    min_trust_score: int = 70,
) -> Dict[str, Any]:
    """Verify one tool_use block against UTA. Returns {'decision': ALLOW|DENY, ...}."""
    import json as _json
    import urllib.request

    payload = {
        **trust_card,
        "tool": tool_name,
        "params": tool_input,
        "min_trust_score": min_trust_score,
    }
    req = urllib.request.Request(
        VERIFY_URL,
        data=_json.dumps({"payload": payload}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = _json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 — fail-closed on ANY error
        return {"decision": "DENY", "reason": f"UTA unreachable: {exc}"}

    allowed = body.get("allowed") is True or body.get("decision") in ("ALLOW", "allow")
    if not allowed:
        return {"decision": "DENY", "reason": f"UTA verdict: {body}"}
    return {"decision": "ALLOW", "response": body}


def guarded_tool_result(tool_use_block: Any, real_executor, trust_card: Dict[str, Any]):
    """Run `real_executor` only if UTA allows; otherwise return a controlled refusal.

    `real_executor(tool_input) -> Any` is YOUR code — the guard never touches
    the Anthropic SDK client, messages, or transport.
    """
    verdict = verify_tool_use(
        getattr(tool_use_block, "name", "unknown_tool"),
        getattr(tool_use_block, "input", {}) or {},
        trust_card,
    )
    if verdict["decision"] == "DENY":
        return {"blocked": True, "reason": verdict["reason"]}
    return {"blocked": False, "result": real_executor(getattr(tool_use_block, "input", {}) or {})}

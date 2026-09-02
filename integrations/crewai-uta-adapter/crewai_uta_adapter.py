r"""
crewai-uta-adapter — Trust verification for CrewAI tools via UTA (fail-closed).

CrewAI's maintainer feedback on alicelabs-llc outreach (#7195) was that CrewAI
already exposes extension points and core integration is not welcome. This
adapter uses exactly those public extension points — a `BaseTool` subclass —
and changes nothing in CrewAI.

Usage:
    from crewai_uta_adapter import UTAProtectedTool, MyTool
    tool = UTAProtectedTool(MyTool(), trust_credential=<trust-card JSON>)

Set UTA_VERIFY_URL to point at another UTA instance (default: public endpoint).
Decision is fail-closed: verification error => tool call DENIED.

Status: POC (v0.1.0). License: AliceLabs Source-Available License v1.0 (AL-1.0).
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

try:
    from crewai.tools import BaseTool  # CrewAI >= 0.70 package layout
except ImportError:  # older layouts / envs without crewai installed
    BaseTool = object  # type: ignore[assignment,misc]

VERIFY_URL = os.environ.get(
    "UTA_VERIFY_URL",
    "https://www.marketnow.site/api/trust?action=verify",
)
TIMEOUT = float(os.environ.get("UTA_VERIFY_TIMEOUT", "5"))


class UTAVerificationError(RuntimeError):
    """Raised when UTA cannot verify (fail-closed path)."""


def verify_with_uta(payload: Dict[str, Any]) -> Dict[str, Any]:
    """POST the credential/trust-card to UTA and return the decision."""
    import json as _json
    import urllib.request

    req = urllib.request.Request(
        VERIFY_URL,
        data=_json.dumps({"payload": payload}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return _json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 — fail-closed on ANY error
        raise UTAVerificationError(f"UTA unreachable: {exc}") from exc


class UTAProtectedTool(BaseTool):
    """Wraps any CrewAI tool; verifies the UTA trust card before every _run."""

    name: str = "uta_protected_tool"
    description: str = "Tool wrapped with UTA trust verification (fail-closed)."

    def __init__(self, inner: Any, trust_credential: Optional[Dict[str, Any]] = None,
                 min_trust_score: int = 70, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._inner = inner
        self._credential = trust_credential
        self._min_score = min_trust_score
        self.name = f"uta_{getattr(inner, 'name', 'tool')}"
        self.description = getattr(inner, 'description', self.description)

    def _decide(self) -> Dict[str, Any]:
        if not self._credential:
            raise UTAVerificationError("no trust credential provided")
        result = verify_with_uta(self._credential)
        if not result.get("valid"):
            raise UTAVerificationError(f"invalid trust card: {result.get('warnings')}")
        score = (result.get("uts") or {}).get("trust", {}).get("score", 0)
        if score < self._min_score:
            raise UTAVerificationError(f"trust score {score} < {self._min_score}")
        return result

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        self._decide()  # fail-closed: raises => tool denied
        return self._inner.run(*args, **kwargs)


if __name__ == "__main__":
    # Smoke test without crewai installed: verify endpoint connectivity.
    try:
        print(verify_with_uta({"probe": "crewai-uta-adapter smoke test"}))
    except UTAVerificationError as exc:
        print("DENIED (fail-closed):", exc)

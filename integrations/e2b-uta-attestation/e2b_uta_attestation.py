r"""
e2b-uta-attestation — Out-of-band trust attestation for E2B sandboxes.

E2B closed our outreach as not_planned (#1791: "tracker, not a forum"). This
adapter changes nothing in E2B: it wraps sandbox execution with a pre-exec
attestation — the code/artifact's UTA trust card is verified BEFORE it runs
inside the sandbox, and an attestation receipt is returned alongside the result.

Fail-closed: unverifiable artifacts never reach the sandbox.

Status: POC (v0.1.0). License: AliceLabs Source-Available License v1.0 (AL-1.0).
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

VERIFY_URL = os.environ.get(
    "UTA_VERIFY_URL",
    "https://www.marketnow.site/api/trust?action=verify",
)
TIMEOUT = float(os.environ.get("UTA_VERIFY_TIMEOUT", "5"))


class UTADenied(RuntimeError):
    """Execution denied by UTA (fail-closed)."""


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


def attested_run(sandbox: Any, code: str,
                 trust_credential: Optional[Dict[str, Any]] = None,
                 min_trust_score: int = 70) -> Dict[str, Any]:
    """Verify, then run `code` inside an E2B sandbox; return result + receipt.

    `sandbox` is any object exposing `run_code(code)` (E2B SDK Sandbox).
    """
    if not trust_credential:
        raise UTADenied("no trust credential provided")
    result = verify_with_uta(trust_credential)
    if not result.get("valid"):
        raise UTADenied(f"invalid trust card: {result.get('warnings')}")
    score = (result.get("uts") or {}).get("trust", {}).get("score", 0)
    if score < min_trust_score:
        raise UTADenied(f"trust score {score} < {min_trust_score}")

    out = sandbox.run_code(code)
    receipt = {
        "kind": "uta_e2b_attestation_v1",
        "at": datetime.now(timezone.utc).isoformat(),
        "code_sha256": hashlib.sha256(code.encode()).hexdigest(),
        "trust_score": score,
        "decision": "ALLOW",
    }
    return {"result": out, "attestation": receipt}


if __name__ == "__main__":
    try:
        print(verify_with_uta({"probe": "e2b-uta-attestation smoke test"}))
    except UTADenied as exc:
        print("DENIED (fail-closed):", exc)

#!/usr/bin/env python3
"""
UTA — Verify an MCP Server Card before invoking (Python).
Repo: https://github.com/alicelabs-llc/universal-trust-adapter
"""
import json, urllib.request, sys

def verify_card(card, api_url="https://www.marketnow.site/api/trust"):
    payload = json.dumps({"card": card}).encode()
    req = urllib.request.Request(f"{api_url}?action=verify", data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def safe_invoke_mcp_server(server_card, tool_name, args):
    result = verify_card(server_card)
    if result.get("decision") != "PERMIT":
        failed = result.get("failed_stage", "unknown")
        raise PermissionError(f"MCP trust verification failed at {failed}")
    print(f"[UTA] Verified issuer={result.get('issuer')}")
    return {"status": "would_invoke", "tool": tool_name, "args": args}

if __name__ == "__main__":
    sample_card = {"mcp_server_card_v1": {"issuer": "did:web:alice.example",
        "server_id": "filesystem-server", "scope": ["read:files"]}}
    try:
        r = safe_invoke_mcp_server(sample_card, "read_file", {"path": "/tmp/test.txt"})
        print(json.dumps(r, indent=2))
    except PermissionError as e:
        print(f"BLOCKED: {e}", file=sys.stderr); sys.exit(1)

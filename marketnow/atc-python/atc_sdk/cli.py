"""ATC CLI — issue, verify, and inspect Agent Trust Cards."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import (
    generate_keypair,
    issue_atc,
    verify_atc,
    verify_atc_sync,
    canonicalize_atc,
    compute_payload_hash,
    __version__,
    __spec_version__,
)


def _load_json(path: str) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error reading {path}: {e}", file=sys.stderr)
        sys.exit(1)


def _load_keypair(path: str):
    from .keys import load_keypair_from_private
    json_data = _load_json(path)
    if "privateKey" not in json_data:
        print(f"Key file {path} must include privateKey (base64 string)", file=sys.stderr)
        sys.exit(1)
    return load_keypair_from_private(json_data["privateKey"])


def cmd_init(args):
    ca = generate_keypair()
    agent = generate_keypair()
    out = {
        "ca": {"publicKey": ca.public_key, "privateKey": ca.private_key},
        "agent": {"publicKey": agent.public_key, "privateKey": agent.private_key},
        "note": "Keep the privateKey fields secret. The publicKey fields can be shared.",
    }
    print(json.dumps(out, indent=2))


def cmd_issue(args):
    ca_kp = _load_keypair(args.ca)
    agent_kp = _load_keypair(args.agent)
    payload = _load_json(args.payload)
    atc = issue_atc(ca_kp, agent_kp, payload)
    if args.out:
        Path(args.out).write_text(json.dumps(atc, indent=2), encoding="utf-8")
        print(f"Wrote {args.out}")
    else:
        print(json.dumps(atc, indent=2))


def cmd_verify(args):
    atc = _load_json(args.card)
    if args.fetch_revocation:
        result = verify_atc(atc, fetch_revocation=True)
    else:
        result = verify_atc_sync(atc)

    print()
    if result["valid"]:
        print(f"\033[1;32m✓ ATC VALID\033[0m  \033[2m({len(result['controls_passed'])}/8 controls passed)\033[0m")
    else:
        print(f"\033[1;31m✗ ATC INVALID\033[0m  \033[2m({len(result['controls_passed'])}/8 controls passed, {len(result['controls_failed'])} failed)\033[0m")

    print()
    print(f"\033[1mCard\033[0m         {result['card_id'] or '(none)'}")
    print(f"\033[1mSpec version\033[0m {result['spec_version'] or '(none)'}")
    print(f"\033[1mCA ID\033[0m        {result['issuer_ca_id'] or '(none)'}")
    print(f"\033[1mAgent\033[0m       {result['agent_id'] or '(none)'} ({result['agent_name'] or '?'})")
    print(f"\033[1mTrust score\033[0m  {result['trust_score'] if result['trust_score'] is not None else '?'}/10  \033[2m({result['risk_level'] or '?'})\033[0m")
    print(f"\033[1mExpires\033[0m     {result['expires_at'] or '(none)'}")
    if result["revoked"]:
        print(f"\033[1mRevoked\033[0m     \033[1;31mYES\033[0m  (reason: {result['revocation_reason'] or 'unknown'})")
    print()
    print("\033[1mControls\033[0m")
    all_controls = ["ATC-001", "ATC-002", "ATC-003", "ATC-004", "ATC-005", "ATC-006", "ATC-007", "ATC-008"]
    for c in all_controls:
        passed = c in result["controls_passed"]
        mark = "\033[32m✓\033[0m" if passed else "\033[31m✗\033[0m"
        print(f"  {mark}  {c}")
    if result["errors"]:
        print()
        print("\033[1;31mErrors\033[0m")
        for e in result["errors"]:
            print(f"  \033[31m-\033[0m {e}")
    if result["warnings"]:
        print()
        print("\033[1;33mWarnings\033[0m")
        for w in result["warnings"]:
            print(f"  \033[33m!\033[0m {w}")
    print()
    sys.exit(0 if result["valid"] else 1)


def cmd_inspect(args):
    atc = _load_json(args.card)
    print()
    print(f"\033[1mATC/{__spec_version__.split('/')[1]} Card\033[0m")
    print("\033[1m" + "═" * 40 + "\033[0m")
    print(f"\033[1mcard_id\033[0m        {atc.get('card_id', '(none)')}")
    print(f"\033[1mspec_version\033[0m   {atc.get('spec_version', '(none)')}")
    print()
    print("\033[1mIdentity\033[0m")
    id_obj = atc.get("identity", {})
    print(f"  agent_id:     {id_obj.get('agent_id', '(none)')}")
    print(f"  agent_name:   {id_obj.get('agent_name', '(none)')}")
    print(f"  agent_owner:  {id_obj.get('agent_owner', '(none)')}")
    print()
    print("\033[1mIssuer\033[0m")
    iss = atc.get("issuer", {})
    print(f"  ca_id:        {iss.get('ca_id', '(none)')}")
    print(f"  ca_url:       {iss.get('ca_url', '(none)')}")
    print(f"  ca_algorithm: {iss.get('ca_algorithm', '(none)')}")
    print()
    print("\033[1mCapabilities\033[0m")
    caps = atc.get("capabilities", {})
    for cat, sub in caps.items():
        print(f"  {cat}:")
        for k, v in (sub or {}).items():
            print(f"    {k}: {v}")
    print()
    print("\033[1mRisk\033[0m")
    r = atc.get("risk", {})
    print(f"  trust_score:        {r.get('trust_score', '?')}/10")
    print(f"  risk_level:         {r.get('risk_level', '(none)')}")
    print(f"  decision_authority: {r.get('decision_authority', '(none)')}")
    print()
    print("\033[1mValidity\033[0m")
    v = atc.get("validity", {})
    print(f"  issued_at:    {v.get('issued_at', '(none)')}")
    print(f"  expires_at:   {v.get('expires_at', '(none)')}")
    print(f"  max_ttl_days: {v.get('max_ttl_days', '?')}")
    print()


def cmd_canonical(args):
    atc = _load_json(args.card)
    print(canonicalize_atc(atc))


def cmd_hash(args):
    atc = _load_json(args.card)
    print(compute_payload_hash(atc))


def main():
    parser = argparse.ArgumentParser(
        prog="atc",
        description="Agent Trust Card CLI (ATC/1.0)",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="Generate a CA + agent keypair")
    p_issue = sub.add_parser("issue", help="Issue (sign) an ATC")
    p_issue.add_argument("--ca", required=True, help="CA private key JSON file")
    p_issue.add_argument("--agent", required=True, help="Agent private key JSON file")
    p_issue.add_argument("--payload", required=True, help="Payload JSON file")
    p_issue.add_argument("--out", help="Output file (default: stdout)")
    p_verify = sub.add_parser("verify", help="Verify an ATC against the spec")
    p_verify.add_argument("card", help="Card JSON file path")
    p_verify.add_argument("--fetch-revocation", action="store_true", help="Fetch the revocation list via HTTP")
    p_inspect = sub.add_parser("inspect", help="Pretty-print an ATC summary")
    p_inspect.add_argument("card", help="Card JSON file path")
    p_canon = sub.add_parser("canonical", help="Print the RFC 8785 JCS canonical form")
    p_canon.add_argument("card", help="Card JSON file path")
    p_hash = sub.add_parser("hash", help="Print the SHA-256 of the canonical payload")
    p_hash.add_argument("card", help="Card JSON file path")
    sub.add_parser("version", help="Print version")

    args = parser.parse_args()

    if args.cmd == "init":
        cmd_init(args)
    elif args.cmd == "issue":
        cmd_issue(args)
    elif args.cmd == "verify":
        cmd_verify(args)
    elif args.cmd == "inspect":
        cmd_inspect(args)
    elif args.cmd == "canonical":
        cmd_canonical(args)
    elif args.cmd == "hash":
        cmd_hash(args)
    elif args.cmd == "version":
        print(f"atc {__version__}")


if __name__ == "__main__":
    main()

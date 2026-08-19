"""ATC/1.0 Python SDK — conformance tests."""

import sys
import os

# Add the package to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from atc_sdk import (
    generate_keypair,
    issue_atc,
    verify_atc_sync,
    resign_atc,
)

PASSED = 0
FAILED = 0


def assert_true(cond, name):
    global PASSED, FAILED
    if cond:
        print(f"  ✓ {name}")
        PASSED += 1
    else:
        print(f"  ✗ {name}")
        FAILED += 1


def make_payload(card_id="ATC-2026-0000001", agent_id="test-001", trust_score=9, risk_level="low"):
    return {
        "card_id": card_id,
        "identity": {"agent_id": agent_id, "agent_name": "Test", "agent_owner": "Org"},
        "capabilities": {
            "filesystem": {"read": "own_dir", "write": "own_dir"},
            "network": {"egress": "allowlist", "ingress": "none"},
            "shell": {"exec": "sandboxed", "spawn": "none"},
            "credentials": {"read_env": "none", "read_files": "none"},
            "process": {"subprocess": "none", "signals": "own"},
        },
        "evidence": {
            "audit_pipeline": "Sentinel L1.5",
            "audit_completed_at": "2026-08-10T12:00:00Z",
            "static_checks": {
                "metadata": True, "semgrep_rules_count": 36, "secret_patterns_count": 18,
                "dependency_scan": True, "malware_patterns_count": 8,
                "malware_family_signatures_count": 48, "prompt_injection_rules_count": 32,
            },
            "dynamic_checks": {
                "sandbox_run": True, "sandbox_runtime_ms": 12453, "sandbox_exit_code": 0,
                "sandbox_network_blocked": True, "sandbox_fs_read_only": True, "sandbox_cap_drop_all": True,
            },
            "runtime_checks": {"interceptor_rules_count": 5, "interceptor_blocks": 0, "interceptor_warns": 0},
            "findings": [],
        },
        "risk": {
            "trust_score": trust_score, "risk_level": risk_level,
            "score_explanation": "clean", "scored_at": "2026-08-10T12:01:00Z",
        },
    }


print("=== ATC/1.0 Python Conformance Test ===\n")

# Test 1: Valid ATC verifies
print("Test 1: A valid ATC verifies all 8 controls")
ca = generate_keypair()
agent = generate_keypair()
atc = issue_atc(ca, agent, make_payload())
result = verify_atc_sync(atc)
assert_true(result["valid"] is True, "Verification succeeds")
assert_true(len(result["controls_passed"]) == 8, "All 8 required controls pass")
assert_true(len(result["controls_failed"]) == 0, "No controls failed")
assert_true(len(result["errors"]) == 0, "No errors")
assert_true(result["card_id"] == "ATC-2026-0000001", "card_id extracted")
assert_true(result["trust_score"] == 9, "trust_score extracted")

# Test 2: Tampered payload
print("\nTest 2: Tampered payload fails ATC-006")
atc2 = issue_atc(ca, agent, make_payload(card_id="ATC-2026-0000002", agent_id="test-002"))
atc2["risk"]["trust_score"] = 1  # tamper
result2 = verify_atc_sync(atc2)
assert_true(result2["valid"] is False, "Tampered ATC fails verification")
assert_true("ATC-006" in result2["controls_failed"], "ATC-006 is in failed list")
assert_true(any("hash mismatch" in e for e in result2["errors"]), "Hash mismatch reported")

# Test 3: Wrong CA key
print("\nTest 3: Wrong CA key fails ATC-006")
atc3 = issue_atc(ca, agent, make_payload(card_id="ATC-2026-0000003", agent_id="test-003"))
wrong_ca = generate_keypair()
result3 = verify_atc_sync(atc3, ca_public_key=wrong_ca.public_key)
assert_true(result3["valid"] is False, "Wrong CA key fails")
assert_true("ATC-006" in result3["controls_failed"], "ATC-006 failed")

# Test 4: Invalid card_id
print("\nTest 4: Invalid card_id format")
atc4 = issue_atc(ca, agent, make_payload(card_id="INVALID-CARD-ID", agent_id="test-004"))
result4 = verify_atc_sync(atc4)
assert_true(result4["valid"] is False, "Invalid card_id fails")
assert_true(any("card_id must match" in e for e in result4["errors"]), "card_id pattern error reported")

# Test 5: Invalid capability enum
print("\nTest 5: Invalid capability enum")
payload5 = make_payload(card_id="ATC-2026-0000005", agent_id="test-005")
payload5["capabilities"]["filesystem"]["read"] = "everything"  # invalid
atc5 = issue_atc(ca, agent, payload5)
result5 = verify_atc_sync(atc5)
assert_true(result5["valid"] is False, "Invalid enum fails")
assert_true("ATC-003" in result5["controls_failed"], "ATC-003 failed")

# Test 6: Trust score out of range
print("\nTest 6: Trust score out of range")
payload6 = make_payload(card_id="ATC-2026-0000006", agent_id="test-006", trust_score=15, risk_level="low")
atc6 = issue_atc(ca, agent, payload6)
atc6["risk"]["trust_score"] = 15  # force out-of-range after issue
resign_atc(atc6, ca)
result6 = verify_atc_sync(atc6)
assert_true(result6["valid"] is False, "trust_score=15 fails")
assert_true("ATC-005" in result6["controls_failed"], "ATC-005 failed")

# Test 7: Expired ATC
print("\nTest 7: ATC expired")
payload7 = make_payload(card_id="ATC-2026-0000007", agent_id="test-007")
payload7["validity"] = {"issued_at": "2026-01-01T00:00:00Z", "expires_at": "2026-01-02T00:00:00Z", "max_ttl_days": 1}
atc7 = issue_atc(ca, agent, payload7)
result7 = verify_atc_sync(atc7)
assert_true(result7["valid"] is False, "Expired ATC fails")
assert_true("ATC-008" in result7["controls_failed"], "ATC-008 failed")
assert_true(any("expired" in e.lower() for e in result7["errors"]), "Expiration error reported")

# Test 8: Missing required fields
print("\nTest 8: Missing required fields")
result8 = verify_atc_sync({"spec_version": "ATC/1.0"})
assert_true(result8["valid"] is False, "Empty ATC fails")
assert_true(len(result8["controls_failed"]) == 8, "All 8 controls fail")

print("\n=== Summary ===")
print(f"Passed: {PASSED}")
print(f"Failed: {FAILED}")
sys.exit(0 if FAILED == 0 else 1)

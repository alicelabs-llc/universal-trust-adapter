#!/usr/bin/env python3
"""
UTA Python SDK — consumer-side library for verifying UTA credentials.

This is a pure-Python implementation that mirrors the TypeScript
@marketnow/trust-core package. It uses the `cryptography` library for
Ed25519, RSA, and ECDSA verification.

Installation:
    pip install uta-python

Usage:
    from uta_python import UTAVerifier

    verifier = UTAVerifier(ca_public_key_pem=open('ca.pem').read())
    result = verifier.verify_credential(json.load(open('credential.json')))
    if result.valid:
        print("✅ Valid")
    else:
        print(f"❌ Invalid: {result.issues}")

AliceLabs Source-Available License v1.0 (AL-1.0)
Copyright (c) 2026 AliceLabs LLC. All rights reserved.
"""

__version__ = '1.0.0'

from .verifier import (
    UTAVerifier,
    VerifyResult,
    canonicalize,
    canonical_hash,
    ed25519_verify,
    verify_atc_v3,
    verify_jwt,
    verify_w3c_vc,
    verify_pop,
    verify_receipt,
)

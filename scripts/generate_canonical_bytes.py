#!/usr/bin/env python3
"""
Generate canonical bytes (hex + base64) and SHA-256 for each test vector.
This is what @anp2network asked for 3 times — publishing the exact canonical
bytes so an external verifier can reproduce the signature without guessing
the preimage.

Output: tests/conformance/vectors/ directory with:
- <vector-id>.json (the original vector)
- <vector-id>.canonical.txt (the canonical JCS bytes as UTF-8 text)
- <vector-id>.bytes.hex (canonical bytes as hex)
- <vector-id>.bytes.base64 (canonical bytes as base64)
- <vector-id>.sha256 (SHA-256 of canonical bytes)
- _index.json (manifest with all vectors, expected outcomes, SHA-256s)
"""
import json
import hashlib
import base64
import os
import copy

# RFC 8785 JCS implementation (from spec)
def jcs_escape(s):
    out = []
    for ch in s:
        c = ord(ch)
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ch in "\b\f\n\r\t":
            out.append({"\b": "\\b", "\f": "\\f", "\n": "\\n",
                        "\r": "\\r", "\t": "\\t"}[ch])
        elif c < 0x20:
            out.append("\\u%04x" % c)
        else:
            out.append(ch)
    return "".join(out)


def jcs_number(n):
    if isinstance(n, bool):
        return "true" if n else "false"
    if isinstance(n, int):
        return str(n)
    if n != n or n in (float("inf"), float("-inf")):
        raise ValueError("non-finite number")
    if n == int(n) and abs(n) < 1e21:
        return str(int(n))
    r = repr(n)
    if "e" in r:
        m, e = r.split("e")
        e = int(e)
        r = m + "e" + ("+" if e >= 0 else "-") + str(abs(e))
    return r


def utf16_units(s):
    b = s.encode("utf-16-be")
    return [int.from_bytes(b[i:i + 2], "big") for i in range(0, len(b), 2)]


def jcs(v):
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, str):
        return '"' + jcs_escape(v) + '"'
    if isinstance(v, (int, float)):
        return jcs_number(v)
    if isinstance(v, list):
        return "[" + ",".join(jcs(x) for x in v) + "]"
    if isinstance(v, dict):
        items = sorted(v.items(), key=lambda kv: utf16_units(kv[0]))
        return "{" + ",".join('"%s":%s' % (jcs_escape(k), jcs(x))
                              for k, x in items) + "}"
    raise TypeError(type(v))


# Load test vectors
VECTORS_DIR = "/home/z/my-project/uta-repo/spec/test-vectors"
OUTPUT_DIR = "/home/z/my-project/uta-repo/tests/conformance/vectors"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load manifest
with open(os.path.join(VECTORS_DIR, "MANIFEST.json")) as f:
    manifest = json.load(f)

index = {
    "schema_version": "1.0.0",
    "published_at": "2026-09-01T00:00:00Z",
    "publisher": "AliceLabs LLC",
    "description": "Canonical bytes for UTA conformance test vectors. Each vector has its JCS-canonicalized bytes published as hex, base64, and UTF-8 text, alongside the SHA-256. An external verifier can use these to reproduce signature verification without guessing the preimage.",
    "canonicalization_method": "RFC 8785 JCS (JSON Canonicalization Scheme)",
    "vectors": []
}

print("=== Generating canonical bytes for test vectors ===\n")

for vector in manifest["vectors"]:
    vec_id = vector["id"]
    vec_file = vector["file"]
    vec_path = os.path.join(VECTORS_DIR, vec_file)
    
    print(f"  Processing: {vec_id} ({vec_file})")
    
    with open(vec_path) as f:
        vec_data = json.load(f)
    
    # Extract the payload to canonicalize
    # For ATC cards, the payload is the card itself (minus signature fields)
    # For other formats, it's the credential payload
    payload = copy.deepcopy(vec_data)
    
    # If it has attestation/signature fields, strip them for canonicalization
    # (the signature is computed over the payload WITHOUT the signature field)
    if "attestation" in payload:
        attestation = payload.pop("attestation")
    elif "signature" in payload:
        signature = payload.pop("signature")
        attestation = signature
    elif "proof" in payload:
        proof = payload.pop("proof")
        attestation = proof
    else:
        attestation = None
    
    # Canonicalize using JCS
    try:
        canonical_str = jcs(payload)
        canonical_bytes = canonical_str.encode("utf-8")
        sha256 = hashlib.sha256(canonical_bytes).hexdigest()
        sha512 = hashlib.sha512(canonical_bytes).hexdigest()
        bytes_hex = canonical_bytes.hex()
        bytes_b64 = base64.b64encode(canonical_bytes).decode("ascii")
        byte_length = len(canonical_bytes)
        
        print(f"    Canonical bytes: {byte_length} bytes")
        print(f"    SHA-256: {sha256}")
        print(f"    First 80 chars: {canonical_str[:80]}...")
        
        # Write the canonical bytes files
        vec_prefix = os.path.join(OUTPUT_DIR, vec_id)
        
        # Original vector
        with open(f"{vec_prefix}.json", "w") as f:
            json.dump(vec_data, f, indent=2, ensure_ascii=False)
        
        # Canonical text
        with open(f"{vec_prefix}.canonical.txt", "w") as f:
            f.write(canonical_str)
        
        # Hex
        with open(f"{vec_prefix}.bytes.hex", "w") as f:
            f.write(bytes_hex)
        
        # Base64
        with open(f"{vec_prefix}.bytes.base64", "w") as f:
            f.write(bytes_b64)
        
        # SHA-256
        with open(f"{vec_prefix}.sha256", "w") as f:
            f.write(sha256)
        
        # Add to index
        index_entry = {
            "id": vec_id,
            "type": vector["type"],
            "format": vector.get("format", "?"),
            "expected_verify": vector.get("expected_verify", True),
            "reason": vector.get("reason", ""),
            "canonical_bytes_length": byte_length,
            "sha256": sha256,
            "sha512": sha512,
            "bytes_hex_file": f"{vec_id}.bytes.hex",
            "bytes_base64_file": f"{vec_id}.bytes.base64",
            "canonical_text_file": f"{vec_id}.canonical.txt",
            "original_vector_file": f"{vec_id}.json",
        }
        
        if attestation:
            if isinstance(attestation, dict):
                if "signature" in attestation:
                    index_entry["signature_base64"] = attestation["signature"]
                if "signed_payload_hash" in attestation:
                    index_entry["stored_signed_payload_hash"] = attestation["signed_payload_hash"]
                if "canonicalization_method" in attestation:
                    index_entry["declared_canonicalization_method"] = attestation["canonicalization_method"]
                if "signed_at" in attestation:
                    index_entry["signed_at"] = attestation["signed_at"]
        
        index["vectors"].append(index_entry)
        
    except Exception as e:
        print(f"    ❌ ERROR canonicalizing: {e}")
        index["vectors"].append({
            "id": vec_id,
            "error": str(e)
        })

# Write index
with open(os.path.join(OUTPUT_DIR, "_index.json"), "w") as f:
    json.dump(index, f, indent=2, ensure_ascii=False)

# Write a README
readme = """# UTA Conformance Vectors — Canonical Bytes

This directory contains the canonical bytes for each UTA conformance test vector.

## Why this exists

@anp2network asked (three times) for the canonical bytes to be published alongside the SHA-256, so an external verifier can reproduce signature verification without guessing the preimage.

> "One ask on format: record the canonical JCS bytes per vector as hex or base64, alongside the SHA-256. The nested-object bug was two implementations disagreeing about the bytes. Shipping the bytes is the only thing that settles that."

## What's in here

For each vector `<id>`:

| File | Contents |
|------|----------|
| `<id>.json` | The original test vector (full credential with signature) |
| `<id>.canonical.txt` | The JCS-canonicalized payload as UTF-8 text |
| `<id>.bytes.hex` | The canonical bytes as hex |
| `<id>.bytes.base64` | The canonical bytes as base64 |
| `<id>.sha256` | The SHA-256 of the canonical bytes |

Plus `_index.json` — a manifest listing all vectors, their expected outcomes, SHA-256s, and signatures.

## Canonicalization method

All vectors are canonicalized using **RFC 8785 JCS** (JSON Canonicalization Scheme):
- Recursive key sort by UTF-16 code unit
- JCS number handling (shortest round-trip)
- JCS string escaping

The signature fields (`attestation`, `signature`, or `proof`) are **stripped** before canonicalization — the signature is computed over the payload without the signature field.

## How to verify

```bash
# 1. Read the canonical bytes
cat valid-atc.canonical.txt

# 2. Compute SHA-256
shasum -a 256 valid-atc.canonical.txt
# Should match valid-atc.sha256

# 3. Verify the signature (Ed25519)
# Using the CA public key from the spec:
# - Take the canonical bytes
# - SHA-256 them
# - Verify the Ed25519 signature from the vector's attestation.signature
```

## Vector inventory

"""

for v in index["vectors"]:
    if "error" in v:
        readme += f"- `{v['id']}`: ERROR — {v['error']}\n"
    else:
        readme += f"- `{v['id']}` ({v['type']}, {v['format']}): {v['canonical_bytes_length']} bytes, SHA-256 `{v['sha256'][:16]}...`, expected_verify={v['expected_verify']}\n"

readme += f"""

## Total: {len(index['vectors'])} vectors

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- RFC 8785 JCS: https://datatracker.ietf.org/doc/html/rfc8785
- Original test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/spec/test-vectors

## Attribution

Published in response to @anp2network's feedback (asked 3 times across 3 comments).
"""

with open(os.path.join(OUTPUT_DIR, "README.md"), "w") as f:
    f.write(readme)

print(f"\n=== SUMMARY ===")
print(f"  Vectors processed: {len(index['vectors'])}")
print(f"  Output directory: {OUTPUT_DIR}")
print(f"  Files created: {len(os.listdir(OUTPUT_DIR))}")
print(f"\n  Files:")
for f in sorted(os.listdir(OUTPUT_DIR)):
    size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
    print(f"    {f:40} ({size} bytes)")

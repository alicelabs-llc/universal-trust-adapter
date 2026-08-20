"use strict";
/**
 * @marketnow/uts
 * BLOQUE C: Universal Trust Schema v2 — Canonical Trust Data Model
 *
 * UTS v2 separates concerns:
 *   - Identity (who)
 *   - Attestations (signed evidence)
 *   - Capabilities (what it can do)
 *   - Policies (what is allowed)
 *   - Provenance (where it came from)
 *   - Lifecycle (when valid)
 *   - Assessment (reproducible score)
 *
 * The score is NOT "trust" — it is a reproducible assessment result
 * linked to hashes of signed evidence.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UTS_V2_JSON_SCHEMA = exports.UTS_VERSION = void 0;
// ── UTS v2.0.0 Types ──────────────────────────────────────────────────────
exports.UTS_VERSION = '2.0.0';
// ── JSON Schema for UTS v2 ────────────────────────────────────────────────
exports.UTS_V2_JSON_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://universal-trust-adapter.vercel.app/specs/UTS-v2.0.json",
    "title": "Universal Trust Schema (UTS) v2.0",
    "description": "Canonical trust data model with separated Identity, Attestations, Evidence, Capabilities, Policies, Provenance, Lifecycle and Assessment.",
    "type": "object",
    "required": ["uts_version", "subject", "identity", "attestations", "capabilities", "policies", "provenance", "lifecycle", "assessment", "format"],
    "properties": {
        "uts_version": { "type": "string", "const": "2.0.0" },
        "subject": { "type": "object", "required": ["id", "name", "type"] },
        "identity": { "type": "object", "required": ["public_keys"] },
        "attestations": { "type": "array" },
        "capabilities": { "type": "object", "required": ["provides", "requires", "protocols"] },
        "policies": { "type": "array" },
        "provenance": { "type": "object", "required": ["source"] },
        "lifecycle": { "type": "object", "required": ["issued_at", "revoked", "version"] },
        "assessment": {
            "type": "object",
            "required": ["methodology", "methodology_version", "inputs", "result", "computed_at", "computed_by", "reproducible"]
        },
        "format": { "type": "object", "required": ["type", "version", "raw"] },
        "warnings": { "type": "array", "items": { "type": "string" } }
    }
};

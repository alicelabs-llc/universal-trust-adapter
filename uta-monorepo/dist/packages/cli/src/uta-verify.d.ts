#!/usr/bin/env node
/**
 * UTA Verify CLI — command-line credential verifier.
 *
 * Usage:
 *   uta-verify <credential-file> --ca-key <ca-public-key.pem>
 *   uta-verify --jwt <token> --ca-key <ca-public-key.pem>
 *   uta-verify --atc-v3 <credential.json> --ca-key <ca-public-key.pem>
 *   uta-verify --vc <verifiable-credential.json> --ca-key <ca-public-key.pem>
 *   uta-verify --a2a <agent-card.json> --ca-key <ca-public-key.pem>
 *   uta-verify --eat <eat-token.json> --ca-key <ca-public-key.pem>
 *   uta-verify --zta <zta-card.json> --ca-key <ca-public-key.pem>
 *   uta-verify --mcp <mcp-card.json> --registry-key <registry-public-key.pem>
 *
 * Options:
 *   --ca-key <path>           Path to CA public key PEM
 *   --registry-key <path>     Path to MCP registry public key PEM
 *   --json                    Output JSON instead of human-readable text
 *   --verbose                 Show all stages (including passes)
 *   --allow-expired           Don't fail on expiry (testing only)
 *   --version                 Show version
 *
 * Exit codes:
 *   0 = credential is VALID
 *   1 = credential is INVALID (signature failed, expired, revoked, etc.)
 *   2 = error (file not found, malformed input, etc.)
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export {};

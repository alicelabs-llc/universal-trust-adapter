/**
 * @marketnow/trust-adapters
 * BLOQUE F: EAT-AI Adapter — IETF Entity Attestation Token (CWT/CBOR)
 * BLOQUE G: W3C VC Adapter — Verifiable Credentials with Ed25519Signature2020
 * BLOQUE H: OAuth/OIDC Adapter — JWT with RS256 + JWKS
 * BLOQUE I: SPIFFE SVID Adapter — X.509 + JWT-SVID
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
import type { UTSv2 } from '../uts/index.js';
export declare class EATAIAdapter {
    formatId: "eat-ai";
    formatName: string;
    formatVersion: string;
    status: "beta";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): Partial<UTSv2>;
    toNative(uts: Partial<UTSv2>): Record<string, unknown>;
}
export declare class W3CVCAdapter {
    formatId: "w3c-vc";
    formatName: string;
    formatVersion: string;
    status: "beta";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): Partial<UTSv2>;
    toNative(uts: Partial<UTSv2>): Record<string, unknown>;
}
export declare class OAuthAdapter {
    formatId: "oauth-token";
    formatName: string;
    formatVersion: string;
    status: "beta";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): Partial<UTSv2>;
    toNative(uts: Partial<UTSv2>): string;
}
export declare class SPIFFEAdapter {
    formatId: "spiffe-svid";
    formatName: string;
    formatVersion: string;
    status: "beta";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): Partial<UTSv2>;
    toNative(uts: Partial<UTSv2>): Record<string, unknown>;
}

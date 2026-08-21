// Package uta provides UTA (Universal Trust Adapter) credential verification in Go.
//
// Implements:
//   - RFC 8785 JCS canonicalization (Canonicalize + CanonicalHash)
//   - Ed25519 signature verification (via crypto/ed25519)
//   - ATC v3 credential verification (VerifyATCv3)
//   - JWT verification (VerifyJWT — EdDSA only)
//   - W3C VC verification (VerifyW3CVC — Ed25519Signature2020)
//
// Usage:
//
//	verifier := uta.NewVerifier(caPublicKeyPEM)
//	result := verifier.VerifyCredential(credentialJSON)
//	fmt.Printf("Valid: %v\n", result.Valid)
//
// AliceLabs Source-Available License v1.0 (AL-1.0)
// Copyright (c) 2026 AliceLabs LLC. All rights reserved.
package uta

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"sort"
	"strings"
)

// Domain separation constants
const (
	DomainATCV3Credential = "UTA-ATC-V3-CREDENTIAL"
	DomainATCV3POP        = "UTA-ATC-V3-POP"
	DomainTrustDecision   = "UTA-TRUST-DECISION"
	DomainW3CVC           = "W3C-VC-DATA-INTEGRITY"
)

// ============================================================================
// RFC 8785 JCS Canonicalization
// ============================================================================

// Canonicalize serializes a JSON value per RFC 8785 (JSON Canonicalization Scheme).
func Canonicalize(value interface{}) (string, error) {
	return canonicalizeValue(value)
}

func canonicalizeValue(value interface{}) (string, error) {
	switch v := value.(type) {
	case nil:
		return "null", nil
	case bool:
		if v {
			return "true", nil
		}
		return "false", nil
	case float64:
		return serializeNumber(v), nil
	case int:
		return serializeNumber(float64(v)), nil
	case int64:
		return serializeNumber(float64(v)), nil
	case json.Number:
		return string(v), nil
	case string:
		return serializeString(v), nil
	case []interface{}:
		var items []string
		for _, elem := range v {
			s, err := canonicalizeValue(elem)
			if err != nil {
				return "", err
			}
			items = append(items, s)
		}
		return "[" + strings.Join(items, ",") + "]", nil
	case map[string]interface{}:
		keys := make([]string, 0, len(v))
		for k := range v {
			if v[k] != nil {
				keys = append(keys, k)
			}
		}
		sort.Slice(keys, func(i, j int) bool {
			return compareUTF16(keys[i], keys[j]) < 0
		})
		var items []string
		for _, k := range keys {
			ks := serializeString(k)
			vs, err := canonicalizeValue(v[k])
			if err != nil {
				return "", err
			}
			items = append(items, ks+":"+vs)
		}
		return "{" + strings.Join(items, ",") + "}", nil
	default:
		return "", fmt.Errorf("cannot canonicalize %T", v)
	}
}

func serializeNumber(num float64) string {
	if num == float64(int64(num)) && num < 9007199254740992 && num > -9007199254740992 {
		return fmt.Sprintf("%d", int64(num))
	}
	s := fmt.Sprintf("%v", num)
	// Normalize exponent (simplified)
	return s
}

func serializeString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\t':
			b.WriteString(`\t`)
		case '\n':
			b.WriteString(`\n`)
		case '\f':
			b.WriteString(`\f`)
		case '\r':
			b.WriteString(`\r`)
		default:
			if r < 0x20 {
				b.WriteString(fmt.Sprintf(`\u%04x`, r))
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

func compareUTF16(a, b string) int {
	aCodes := toUTF16Codes(a)
	bCodes := toUTF16Codes(b)
	for i := 0; i < len(aCodes) && i < len(bCodes); i++ {
		if aCodes[i] < bCodes[i] {
			return -1
		}
		if aCodes[i] > bCodes[i] {
			return 1
		}
	}
	return len(aCodes) - len(bCodes)
}

func toUTF16Codes(s string) []uint16 {
	var codes []uint16
	for _, r := range s {
		if r > 0xFFFF {
			offset := r - 0x10000
			codes = append(codes, uint16(0xD800+(offset>>10)))
			codes = append(codes, uint16(0xDC00+(offset&0x3FF)))
		} else {
			codes = append(codes, uint16(r))
		}
	}
	return codes
}

// CanonicalHash returns the SHA-256 hex digest of Canonicalize(value).
func CanonicalHash(value interface{}) (string, error) {
	canonical, err := Canonicalize(value)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(hash[:]), nil
}

// ============================================================================
// Ed25519 Verification
// ============================================================================

// Ed25519Verify verifies an Ed25519 signature over `domain:canonicalize(payload)`.
func Ed25519Verify(payload interface{}, signatureHex string, publicKeyPEM string, domain string) bool {
	canonical, err := Canonicalize(payload)
	if err != nil {
		return false
	}
	signingInput := domain + ":" + canonical

	sigBytes, err := hex.DecodeString(signatureHex)
	if err != nil || len(sigBytes) != 64 {
		return false
	}

	pubKey, err := parseEd25519PublicKey(publicKeyPEM)
	if err != nil {
		return false
	}

	return ed25519.Verify(pubKey, []byte(signingInput), sigBytes)
}

func parseEd25519PublicKey(pemStr string) (ed25519.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM")
	}
	// Ed25519 SPKI DER: 12 bytes header + 32 bytes raw key
	if len(block.Bytes) < 44 {
		return nil, fmt.Errorf("DER too short")
	}
	rawKey := block.Bytes[len(block.Bytes)-32:]
	return ed25519.PublicKey(rawKey), nil
}

// ============================================================================
// Verification Result
// ============================================================================

type VerifyResult struct {
	Valid        bool     `json:"valid"`
	Format       string   `json:"format"`
	Issues       []string `json:"issues"`
	CredentialID string   `json:"credential_id,omitempty"`
	Issuer       string   `json:"issuer,omitempty"`
	Subject      string   `json:"subject,omitempty"`
	ExpiresAt    string   `json:"expires_at,omitempty"`
}

func newResult(format string) *VerifyResult {
	return &VerifyResult{
		Valid:  false,
		Format: format,
		Issues: []string{},
	}
}

// ============================================================================
// ATC v3 Verification
// ============================================================================

// VerifyATCv3 verifies an ATC v3 credential's Ed25519 signature.
func VerifyATCv3(cred map[string]interface{}, caPublicKeyPEM string) *VerifyResult {
	result := newResult("atc-v3")

	atcVersion, _ := cred["atc_version"].(string)
	if !strings.HasPrefix(atcVersion, "3.") {
		result.Issues = append(result.Issues, fmt.Sprintf("wrong atc_version: %s", atcVersion))
		return result
	}

	sigsRaw, ok := cred["signatures"].([]interface{})
	if !ok || len(sigsRaw) == 0 {
		result.Issues = append(result.Issues, "no signatures found")
		return result
	}

	sig, _ := sigsRaw[0].(map[string]interface{})
	sigValue, _ := sig["value"].(string)
	if len(sigValue) != 128 {
		result.Issues = append(result.Issues, fmt.Sprintf("malformed signature: %d chars", len(sigValue)))
		return result
	}

	domain, _ := sig["domain"].(string)
	if domain != DomainATCV3Credential {
		result.Issues = append(result.Issues, fmt.Sprintf("wrong domain: %s", domain))
	}

	// Build payload (credential without signatures)
	payload := make(map[string]interface{})
	for k, v := range cred {
		if k != "signatures" {
			payload[k] = v
		}
	}

	if !Ed25519Verify(payload, sigValue, caPublicKeyPEM, DomainATCV3Credential) {
		result.Issues = append(result.Issues, "Ed25519 signature verification failed")
	}

	// evidence_hash check
	canonical, _ := Canonicalize(payload)
	h := sha256.Sum256([]byte(canonical + sigValue))
	expectedEvidenceHash := "sha256:" + hex.EncodeToString(h[:])
	actualEvidenceHash, _ := sig["evidence_hash"].(string)
	if actualEvidenceHash != expectedEvidenceHash {
		result.Issues = append(result.Issues, "evidence_hash mismatch")
	}

	if id, ok := cred["credential_id"].(string); ok {
		result.CredentialID = id
	}
	if issuer, ok := cred["issuer"].(map[string]interface{}); ok {
		if did, ok := issuer["did"].(string); ok {
			result.Issuer = did
		}
	}
	if lifecycle, ok := cred["lifecycle"].(map[string]interface{}); ok {
		if exp, ok := lifecycle["expires_at"].(string); ok {
			result.ExpiresAt = exp
		}
	}
	result.Valid = len(result.Issues) == 0
	return result
}

// ============================================================================
// JWT Verification (EdDSA only)
// ============================================================================

// VerifyJWT verifies a JWT (EdDSA only).
func VerifyJWT(jwt string, publicKeyPEM string) *VerifyResult {
	result := newResult("jwt")

	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		result.Issues = append(result.Issues, "invalid JWT format (expected 3 parts)")
		return result
	}

	headerB64, payloadB64, sigB64 := parts[0], parts[1], parts[2]

	headerBytes, err := base64.RawURLEncoding.DecodeString(headerB64)
	if err != nil {
		result.Issues = append(result.Issues, "invalid header encoding")
		return result
	}
	var header map[string]interface{}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		result.Issues = append(result.Issues, fmt.Sprintf("header decode error: %v", err))
		return result
	}

	alg, _ := header["alg"].(string)
	if alg == "none" {
		result.Issues = append(result.Issues, "algorithm \"none\" is forbidden")
		return result
	}
	if alg == "HS256" {
		result.Issues = append(result.Issues, "HS256 not supported")
		return result
	}
	if alg != "EdDSA" {
		result.Issues = append(result.Issues, fmt.Sprintf("unsupported alg: %s (only EdDSA in Go SDK)", alg))
		return result
	}

	signingInput := headerB64 + "." + payloadB64
	sig, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil || len(sig) != 64 {
		result.Issues = append(result.Issues, "invalid signature")
		return result
	}

	pubKey, err := parseEd25519PublicKey(publicKeyPEM)
	if err != nil {
		result.Issues = append(result.Issues, "failed to parse public key")
		return result
	}

	if !ed25519.Verify(pubKey, []byte(signingInput), sig) {
		result.Issues = append(result.Issues, "EdDSA signature verification failed")
	}

	// Parse claims
	claimsBytes, _ := base64.RawURLEncoding.DecodeString(payloadB64)
	var claims map[string]interface{}
	json.Unmarshal(claimsBytes, &claims)
	if iss, ok := claims["iss"].(string); ok {
		result.Issuer = iss
	}
	if sub, ok := claims["sub"].(string); ok {
		result.Subject = sub
	}

	result.Valid = len(result.Issues) == 0
	return result
}

// ============================================================================
// W3C VC Verification (Ed25519Signature2020)
// ============================================================================

// VerifyW3CVC verifies a W3C VC with Ed25519Signature2020 proof.
func VerifyW3CVC(vc map[string]interface{}, publicKeyPEM string) *VerifyResult {
	result := newResult("vc")

	proof, ok := vc["proof"].(map[string]interface{})
	if !ok {
		result.Issues = append(result.Issues, "missing proof")
		return result
	}

	proofType, _ := proof["type"].(string)
	if proofType != "Ed25519Signature2020" {
		result.Issues = append(result.Issues, fmt.Sprintf("unsupported proof type: %s", proofType))
		return result
	}

	proofValue, _ := proof["proofValue"].(string)
	sig, err := base64.RawURLEncoding.DecodeString(proofValue)
	if err != nil || len(sig) != 64 {
		result.Issues = append(result.Issues, "invalid proofValue")
		return result
	}

	// Build payload (VC without proof)
	payload := make(map[string]interface{})
	for k, v := range vc {
		if k != "proof" {
			payload[k] = v
		}
	}

	canonical, _ := Canonicalize(payload)
	signingInput := DomainW3CVC + ":" + canonical

	pubKey, err := parseEd25519PublicKey(publicKeyPEM)
	if err != nil {
		result.Issues = append(result.Issues, "failed to parse public key")
		return result
	}

	if !ed25519.Verify(pubKey, []byte(signingInput), sig) {
		result.Issues = append(result.Issues, "Ed25519Signature2020 verification failed")
	}

	if id, ok := vc["id"].(string); ok {
		result.CredentialID = id
	}
	if issuer, ok := vc["issuer"].(string); ok {
		result.Issuer = issuer
	}
	result.Valid = len(result.Issues) == 0
	return result
}

// ============================================================================
// Main Verifier — auto-detects format
// ============================================================================

type Verifier struct {
	caPublicKeyPEM string
}

// NewVerifier creates a new UTA verifier with the given CA public key.
func NewVerifier(caPublicKeyPEM string) *Verifier {
	return &Verifier{caPublicKeyPEM: caPublicKeyPEM}
}

// VerifyCredential verifies any credential format. Auto-detects from the structure.
func (v *Verifier) VerifyCredential(credential interface{}) *VerifyResult {
	// Unwrap test vector format
	cred, ok := credential.(map[string]interface{})
	if !ok {
		return &VerifyResult{
			Valid:  false,
			Format: "unknown",
			Issues: []string{"credential is not a JSON object"},
		}
	}
	if input, ok := cred["input"].(map[string]interface{}); ok {
		if _, hasVecID := cred["vector_id"]; hasVecID {
			cred = input
		}
	}

	// JWT
	if jwt, ok := cred["jwt"].(string); ok {
		return VerifyJWT(jwt, v.caPublicKeyPEM)
	}

	// ATC v3
	if atcVersion, ok := cred["atc_version"].(string); ok && strings.HasPrefix(atcVersion, "3.") {
		return VerifyATCv3(cred, v.caPublicKeyPEM)
	}

	// W3C VC
	if ctx, ok := cred["@context"].([]interface{}); ok {
		for _, c := range ctx {
			if cs, ok := c.(string); ok && cs == "https://www.w3.org/2018/credentials/v1" {
				return VerifyW3CVC(cred, v.caPublicKeyPEM)
			}
		}
	}

	return &VerifyResult{
		Valid:  false,
		Format: "unknown",
		Issues: []string{"cannot auto-detect credential format"},
	}
}

// VerifyCredentialJSON verifies a credential from a JSON string.
func (v *Verifier) VerifyCredentialJSON(jsonStr string) *VerifyResult {
	var cred interface{}
	if err := json.Unmarshal([]byte(jsonStr), &cred); err != nil {
		return &VerifyResult{
			Valid:  false,
			Format: "unknown",
			Issues: []string{fmt.Sprintf("JSON parse error: %v", err)},
		}
	}
	return v.VerifyCredential(cred)
}

// VerifyCredentialFile verifies a credential from a file path.
func (v *Verifier) VerifyCredentialFile(path string) *VerifyResult {
	data, err := readFile(path)
	if err != nil {
		return &VerifyResult{
			Valid:  false,
			Format: "unknown",
			Issues: []string{fmt.Sprintf("file read error: %v", err)},
		}
	}
	return v.VerifyCredentialJSON(string(data))
}

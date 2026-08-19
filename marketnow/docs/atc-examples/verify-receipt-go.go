// MarketNow — Action Receipt verification example (Go)
//
// Verifies a MarketNow action-receipt cryptographically against the
// MarketNow CA public key. No server-side trust required — fetch the
// receipt + CA key, verify the Ed25519 signature client-side.
//
// Receipts are signed delivery proofs for completed purchases.
// Use this to confirm that a purchase actually completed end-to-end.
//
// Interop with Vibe (doteyeso-ops):
//   receipt_id     ↔ vibe_action_receipt (offline-verifiable delivery proof)
//   mandate_id     ↔ vibe_decision_ref  (content-addressed auth citation)
//   settle_txhash  ↔ vibe_settle_coordinate (orthogonal to receipt)
//
// Usage:
//   go run verify-receipt-go.go rcpt_c8b9dc67f88e4da5bd3a
//   go run verify-receipt-go.go  # uses default demo receipt
//
// Required Go version: 1.21+ (for crypto ed25519 stdlib support)

package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
)

const (
	apiBase          = "https://marketnow.site"
	defaultReceiptID = "rcpt_c8b9dc67f88e4da5bd3a"
)

// ─── RFC 8785 JCS Canonical JSON ────────────────────────────────────────────
// Minimal implementation matching MarketNow's lib/canonical-json.mjs
// Full spec: https://tools.ietf.org/html/rfc8785

func canonicalize(v interface{}) string {
	switch val := v.(type) {
	case nil:
		return "null"
	case bool:
		if val {
			return "true"
		}
		return "false"
	case float64:
		// JSON numbers always unmarshal to float64 in Go
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%g", val), "0"), ".")
	case string:
		return serializeString(val)
	case []interface{}:
		parts := make([]string, len(val))
		for i, item := range val {
			parts[i] = canonicalize(item)
		}
		return "[" + strings.Join(parts, ",") + "]"
	case map[string]interface{}:
		return serializeObject(val)
	}
	return serializeString(fmt.Sprintf("%v", v))
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

func serializeObject(obj map[string]interface{}) string {
	keys := make([]string, 0, len(obj))
	for k := range obj {
		keys = append(keys, k)
	}
	// RFC 8785: sort by UTF-16 code unit values
	sort.Slice(keys, func(i, j int) bool {
		ki, kj := []rune(keys[i]), []rune(keys[j])
		for x := 0; x < len(ki) && x < len(kj); x++ {
			if ki[x] != kj[x] {
				return ki[x] < kj[x]
			}
		}
		return len(ki) < len(kj)
	})
	if len(keys) == 0 {
		return "{}"
	}
	parts := make([]string, len(keys))
	for i, k := range keys {
		parts[i] = serializeString(k) + ":" + canonicalize(obj[k])
	}
	return "{" + strings.Join(parts, ",") + "}"
}

// ─── Receipt verification ───────────────────────────────────────────────────

type caKeyResponse struct {
	PublicKeyPEM string `json:"public_key_pem"`
}

type receiptResponse struct {
	Valid           bool                   `json:"valid"`
	ReceiptID       string                 `json:"receipt_id"`
	Reason          string                 `json:"reason"`
	IssuedAt        string                 `json:"issued_at"`
	MandateID       *string                `json:"mandate_id"`
	SettleTxhash    *string                `json:"settle_txhash"`
	AtcCardID       *string                `json:"atc_card_id"`
	Delivered       map[string]interface{} `json:"delivered"`
	AmountUSD       float64                `json:"amount_usd"`
	Network         string                 `json:"network"`
	Signature       map[string]interface{} `json:"signature"`
	SignatureValid  bool                   `json:"signature_valid"`
	Interop         map[string]interface{} `json:"interop"`
}

func fetchCAPublicKey() (ed25519.PublicKey, error) {
	r, err := http.Get(apiBase + "/api/atc?action=ca-key")
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()

	var ca caKeyResponse
	if err := json.NewDecoder(r.Body).Decode(&ca); err != nil {
		return nil, err
	}

	block, _ := pem.Decode([]byte(ca.PublicKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("failed to parse PEM block")
	}

	// The PEM is SPKI format. For Ed25519, the raw public key is the last 32 bytes.
	if len(block.Bytes) < 32 {
		return nil, fmt.Errorf("SPKI block too short")
	}
	return ed25519.PublicKey(block.Bytes[len(block.Bytes)-32:]), nil
}

func fetchReceipt(receiptID string) (*receiptResponse, error) {
	url := fmt.Sprintf("%s/api/atc?action=verify-receipt&receipt_id=%s", apiBase, receiptID)
	r, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()

	if r.StatusCode == 404 {
		return nil, fmt.Errorf("receipt not found")
	}

	var resp receiptResponse
	if err := json.NewDecoder(r.Body).Decode(&resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func fetchRawReceipt(receiptID string) (map[string]interface{}, error) {
	url := fmt.Sprintf(
		"https://raw.githubusercontent.com/edgarfloresguerra2011-a11y/marketnow/master/_data/receipts/%s.json",
		receiptID,
	)
	r, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}

	// Compute SHA-256 of the raw bytes (for content-addressability)
	hash := sha256.Sum256(body)
	fmt.Printf("      Raw receipt SHA-256: %s\n", hex.EncodeToString(hash[:]))

	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func verifyReceiptSignature(raw map[string]interface{}, caKey ed25519.PublicKey) (bool, error) {
	sigBlock, ok := raw["signature"].(map[string]interface{})
	if !ok {
		return false, fmt.Errorf("receipt missing signature block")
	}

	sigHex, ok := sigBlock["value"].(string)
	if !ok {
		return false, fmt.Errorf("signature.value missing or not a string")
	}

	// Strip signature field to reconstruct the signed payload
	payload := make(map[string]interface{})
	for k, v := range raw {
		if k != "signature" {
			payload[k] = v
		}
	}

	// Canonicalize via RFC 8785 JCS
	canonical := canonicalize(payload)

	// Decode signature from hex
	sig, err := hex.DecodeString(sigHex)
	if err != nil {
		return false, fmt.Errorf("invalid hex signature: %w", err)
	}

	// Verify Ed25519 signature
	valid := ed25519.Verify(caKey, []byte(canonical), sig)
	return valid, nil
}

func main() {
	receiptID := defaultReceiptID
	if len(os.Args) > 1 {
		receiptID = os.Args[1]
	}

	fmt.Printf("Verifying receipt: %s\n", receiptID)
	fmt.Printf("API: %s\n", apiBase)
	fmt.Println()

	// Step 1: Fetch CA public key
	fmt.Println("[1/3] Fetching CA public key...")
	caKey, err := fetchCAPublicKey()
	if err != nil {
		fmt.Printf("      ✗ Failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("      ✓ CA key loaded (Ed25519)")

	// Step 2: Fetch receipt
	fmt.Println("[2/3] Fetching receipt from ledger...")
	receipt, err := fetchReceipt(receiptID)
	if err != nil {
		fmt.Printf("      ✗ Failed: %v\n", err)
		os.Exit(1)
	}
	if !receipt.Valid {
		fmt.Printf("      ✗ Receipt invalid: %s\n", receipt.Reason)
		os.Exit(1)
	}
	fmt.Printf("      ✓ Receipt found, signature_valid=%v\n", receipt.SignatureValid)

	// Step 3: Verify signature locally
	fmt.Println("[3/3] Verifying signature locally against CA key...")
	raw, err := fetchRawReceipt(receiptID)
	if err != nil {
		fmt.Printf("      ✗ Failed to fetch raw receipt: %v\n", err)
		os.Exit(1)
	}

	valid, err := verifyReceiptSignature(raw, caKey)
	if err != nil {
		fmt.Printf("      ✗ Verification error: %v\n", err)
		os.Exit(1)
	}
	if !valid {
		fmt.Println("      ✗ Signature INVALID — receipt may have been tampered with")
		os.Exit(1)
	}
	fmt.Println("      ✓ Signature verified (Ed25519, RFC 8785 JCS)")

	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Printf("  ✓ RECEIPT VERIFIED: %s\n", receiptID)
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Printf("  Issued at:     %s\n", receipt.IssuedAt)
	if receipt.MandateID != nil {
		fmt.Printf("  Mandate ID:    %s\n", *receipt.MandateID)
	} else {
		fmt.Println("  Mandate ID:    (null — direct purchase)")
	}
	if receipt.SettleTxhash != nil {
		fmt.Printf("  Settle txHash: %s\n", *receipt.SettleTxhash)
	}
	if receipt.AtcCardID != nil {
		fmt.Printf("  ATC card ID:   %s\n", *receipt.AtcCardID)
	}
	fmt.Println("  Delivered:")
	if delivered, ok := receipt.Delivered["skill_id"].(string); ok {
		fmt.Printf("    Skill ID:    %s\n", delivered)
	}
	if lic, ok := receipt.Delivered["license_key"].(string); ok {
		fmt.Printf("    License key: %s\n", lic)
	}
	fmt.Printf("  Amount:        $%.2f (%s)\n", receipt.AmountUSD, receipt.Network)
	fmt.Println()
	fmt.Println("  Interop (Vibe join-key map):")
	if receipt.Interop != nil {
		if v, ok := receipt.Interop["vibe_decision_ref"].(string); ok {
			fmt.Printf("    vibe_decision_ref:      %s\n", v)
		}
		if v, ok := receipt.Interop["vibe_settle_coordinate"].(string); ok {
			fmt.Printf("    vibe_settle_coordinate: %s\n", v)
		}
		if v, ok := receipt.Interop["vibe_action_receipt"].(string); ok {
			fmt.Printf("    vibe_action_receipt:    %s\n", v)
		}
	}
	fmt.Println("═══════════════════════════════════════════════════════════")

	_ = bytes.NewBuffer // keep import if not used elsewhere
}

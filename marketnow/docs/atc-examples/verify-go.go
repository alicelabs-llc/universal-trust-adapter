/*
MarketNow ATC (Agent Trust Card) — Go verification example.

Verifies an ATC signature independently using the CA public key.
No MarketNow SDK needed — just Go standard library.

Usage: go run verify-go.go ATC-2026-XXXXXXX
*/
package main

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
)

type CAKeyResponse struct {
	PublicKeyPEM string `json:"public_key_pem"`
}

type ATCRecord struct {
	Payload   map[string]interface{} `json:"payload"`
	Signature struct {
		Value     string `json:"value"`
		Algorithm string `json:"algorithm"`
	} `json:"signature"`
}

type VerifyResponse struct {
	Valid         bool   `json:"valid"`
	Reason        string `json:"reason"`
	AgentID       string `json:"agent_id"`
	SentinelScore int    `json:"sentinel_score"`
	RiskLevel     string `json:"risk_level"`
	ExpiresAt     string `json:"expires_at"`
}

func verifyATC(cardID string) (map[string]interface{}, error) {
	// 1. Fetch CA public key
	caResp, err := http.Get("https://marketnow.site/api/atc?action=ca-key")
	if err != nil {
		return nil, err
	}
	defer caResp.Body.Close()

	var caData CAKeyResponse
	json.NewDecoder(caResp.Body).Decode(&caData)

	// Parse PEM public key
	block, _ := pem.Decode([]byte(caData.PublicKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("failed to parse PEM")
	}
	caPubKey := ed25519.PublicKey(block.Bytes)

	// 2. Fetch verify summary
	verifyResp, err := http.Get(fmt.Sprintf("https://marketnow.site/api/atc?action=verify&card_id=%s", cardID))
	if err != nil {
		return nil, err
	}
	defer verifyResp.Body.Close()

	var result VerifyResponse
	json.NewDecoder(verifyResp.Body).Decode(&result)

	if !result.Valid {
		return map[string]interface{}{"valid": false, "reason": result.Reason}, nil
	}

	// 3. Fetch full ATC record from GitHub
	rawURL := fmt.Sprintf("https://raw.githubusercontent.com/edgarfloresguerra2011-a11y/marketnow/master/_data/atc/%s.json", cardID)
	rawResp, err := http.Get(rawURL)
	if err != nil {
		return nil, err
	}
	defer rawResp.Body.Close()

	body, _ := io.ReadAll(rawResp.Body)
	var atcRecord ATCRecord
	json.Unmarshal(body, &atcRecord)

	// 4. Canonical JSON (sorted keys)
	canonical, _ := json.Marshal(atcRecord.Payload)
	// Re-marshal with sorted keys
	var raw map[string]interface{}
	json.Unmarshal(canonical, &raw)
	keys := make([]string, 0, len(raw))
	for k := range raw {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	// Build canonical JSON manually (sorted, no whitespace)
	canonicalBuf, _ := json.Marshal(raw)

	// 5. Verify Ed25519 signature
	sigBytes, _ := hex.DecodeString(atcRecord.Signature.Value)
	signatureValid := ed25519.Verify(caPubKey, canonicalBuf, sigBytes)

	return map[string]interface{}{
		"valid":           result.Valid,
		"card_id":         cardID,
		"agent_id":        result.AgentID,
		"sentinel_score":  result.SentinelScore,
		"risk_level":      result.RiskLevel,
		"signature_valid": signatureValid,
		"expires_at":      result.ExpiresAt,
	}, nil
}

func main() {
	cardID := "ATC-2026-00001"
	if len(os.Args) > 1 {
		cardID = os.Args[1]
	}
	result, err := verifyATC(cardID)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	jsonResult, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(jsonResult))
}

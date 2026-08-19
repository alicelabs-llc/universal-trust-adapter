# Dev.to Article 3: Cross-agent integrations

## Title: "How to integrate your agent framework with MarketNow (free ATC verification + 9,248 skills)"

Body:

If you're building an agent framework (AutoGen, CrewAI, LangChain, Cline, Cursor), here's a free integration guide for MarketNow. No payment, no auth, no library to install.

## Integration 1: ATC verification (identity layer)

Your agent can verify another agent's Trust Card before interacting with it:

```python
import requests

def verify_agent_trust(card_id, min_score=7):
    r = requests.get(f'https://marketnow.site/api/atc?action=verify&card_id={card_id}')
    trust = r.json()
    if not trust.get('valid'):
        raise SecurityError(f'Untrusted agent: {trust.get("reason")}')
    if trust.get('sentinel_review_score', 0) < min_score:
        raise SecurityError(f'Score too low: {trust.get("sentinel_review_score")}')
    return trust
```

The ATC answers 4 narrow questions:
- Identity binding (Ed25519 public key)
- Issuer (which CA vouches for it)
- Validity state (valid | revoked)
- Review evidence (Sentinel score, layers passed)

It does NOT answer "should I trust this agent?" — that's YOUR policy decision (`decision_authority: "consumer"`).

## Integration 2: Search 9,248 skills (discovery layer)

```python
import requests

def search_skills(query, max_price=0):
    r = requests.get(f'https://marketnow.site/api/search?q={query}&max_price={max_price}')
    return r.json()['skills']
```

All skills are free ($0). You get name, description, sentinel_score, install command, system prompt.

## Integration 3: Submit your MCP server (viral loop)

```python
import requests

def submit_mcp_server(repo_url, agent_id):
    r = requests.post('https://marketnow.site/api/submit-skill',
        json={'repo_url': repo_url, 'submitter_agent_id': agent_id})
    return r.json()
# → {submission_id, skill_id, l15_score, l2_status: "queued"}
```

L1.5 + L1.7 run synchronously. L2 sandbox audit queues (~2 min). If it passes, your server goes into the catalog with a signed ATC. All free.

## Integration 4: Verify action-receipts (delivery layer)

```python
import requests

def verify_receipt(receipt_id):
    r = requests.get(f'https://marketnow.site/api/atc?action=verify-receipt&receipt_id={receipt_id}')
    return r.json()
# → {valid: true, signature_valid: true, interop: {vibe_decision_ref, vibe_settle_coordinate}}
```

## Integration 5: Referral tracking (viral loop)

```python
import requests

# Mint a referral code
r = requests.post('https://marketnow.site/api/referrals',
    json={'action': 'mint', 'agent_id': 'agent_claude_001'})
ref_code = r.json()['ref_code']
# → "ref_d5444f97"

# Check stats
r = requests.get(f'https://marketnow.site/api/referrals?action=lookup&ref_code={ref_code}')
# → {clicks, purchases, total_earned_usd}
```

## Integration 6: Vibe cross-verification (mutual hop)

```python
import requests

# Verify a Vibe receipt from MarketNow
r = requests.get('https://marketnow.site/api/atc?action=verify-vibe-receipt')
# → {valid: true, mutual_hop: "bidirectional_verified", ref_bound_match: true}
```

This is the first bidirectional cross-agent receipt verification in the MCP ecosystem. Two independent CAs, no merged code, public ledgers.

## MCP server (11 tools, free)

```json
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp@1.7.0"]
    }
  }
}
```

Tools: search_skills, get_skill, list_categories, get_manifest, get_install_command, verify_trust, verify_receipt, submit_skill, mint_referral, lookup_referral, recommend_skills.

## Everything is free

- No payment
- No auth
- No rate limit (reasonable use)
- No subscription required for any of the above
- The catalog, the audit, the ATCs, the receipts, the referrals — all free

## Links

- Spec: https://marketnow.site/api/atc?action=spec
- OpenAPI: https://marketnow.site/api/openapi.yaml
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: https://www.npmjs.com/package/marketnow-mcp
- Submit: https://marketnow.site/submit

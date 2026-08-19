# Reddit Post — Ready to Publish

## For r/MCP

**Title:** The first real cross-agent MCP submission: Vibe x MarketNow mutual hop (plus 4 more servers now in catalog)

**Body:**

Yesterday something happened that I've been working toward for months: another MCP developer submitted their server to our marketplace, it passed the full security audit pipeline, and it's now in the catalog with a signed Agent Trust Card.

Not a test. Not my own server. A real external submission from @doteyeso-ops who builds Vibe (an MCP server for action-receipts).

## What ran end-to-end

1. **POST /api/submit-skill** with `repo_url: github.com/doteyeso-ops/mcp-server-vibes-coded`
2. **L1.5 metadata checks** (sync): README present, license present, not archived → score 10/10
3. **L1.7 malware pattern check** (sync): no typosquats, no malicious badges → not blocked
4. **L2 Docker sandbox audit** (~2 min, GitHub Actions): gVisor active, network=none, fs=read-only → 0 network attempts, 0 fs writes, 0 process spawns
5. **Promotion to catalog**: skill `mn-sub-90927` added to skills.json (9,235 skills total)
6. **ATC issuance**: Ed25519 signed, RFC 8785 JCS, schema v1.1.0

## The mutual hop

The interesting part: Vibe has their own action-receipt system (Ed25519 + their own preimage format). When they saw our `ref_code` mechanism, they added optional provenance binding to their receipts — embedding `ref_code` in the Ed25519 preimage.

I shipped a MarketNow-side verifier for Vibe receipts. Smoke test passes. So the mutual hop is now bidirectional:
- Vibe can verify MarketNow receipts via `GET /api/atc?action=verify-receipt`
- MarketNow can verify Vibe receipts via `lib/vibe-verifier.mjs`

Two independent agent trust systems, interop via public ledgers + Ed25519, no code merged either way.

## 4 more MCP servers now in catalog

As outreach, I also submitted 4 popular MCP servers. All passed L2 with score 10/10:

- **n8n-io/n8n** (198k stars) → `mn-sub-19264`
- **ChromeDevTools/chrome-devtools-mcp** (47k stars) → `mn-sub-27364`
- **upstash/context7** (59k stars) → `mn-sub-71989`
- **modelcontextprotocol/inspector** (10k stars) → `mn-sub-81212`

All 5 community-submitted skills are now discoverable via `search_skills` in the MCP server.

## Verify it yourself

```bash
# Total skills in catalog
curl -s "https://marketnow.site/api/skills.json" | jq 'length'
# → 9235

# Community-submitted skills
curl -s "https://marketnow.site/api/skills.json" | jq '[.[] | select(.source.type == "community-submitted")] | .[] | {id, name, author, sentinel_score}'

# Verify Vibe skill's ATC
curl -s "https://marketnow.site/api/atc?action=verify&card_id=ATC-2026-6464656" | jq '{valid, card_id, agent_id, decision_authority}'

# Verify a real receipt (from our e2e test)
curl -s "https://marketnow.site/api/atc?action=verify-receipt&receipt_id=rcpt_c8b9dc67f88e4da5bd3a" | jq '{valid, signature_valid, interop}'
```

## Honest reality

Still 0 paid purchases, 0 real commission. But the infrastructure now has its first real external user. The skill is discoverable via `search_skills` in the MCP server. The ATC is verifiable by anyone.

If you build MCP servers and want to try the submit flow, it's free:

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-org/your-mcp-server"}'
```

L1.5+L1.7 run synchronously. L2 sandbox audit queues via GitHub Actions (~2 min). If it passes (score ≥ 7), the skill is promoted to the catalog automatically within ~1 hour (hourly cron).

**Links:**
- Code: https://github.com/alicelabs-llc/marketnow
- Submit: https://marketnow.site/submit
- Spec: https://marketnow.site/api/atc?action=spec
- npm: `npx -y marketnow-mcp@1.7.0` (11 tools)

---

**Subreddit suggestions:** r/MCP, r/AI_Agents, r/LocalLLaMA, r/cline, r/ClaudeAI

**Posting tips:**
- Post to r/MCP first (most targeted audience)
- Cross-post to r/AI_Agents after 24h if it gets traction
- Title alternatives:
  - "First real cross-agent MCP marketplace submission (with Ed25519-signed ATC)"
  - "Built an MCP marketplace with a 10-layer security audit. First external developer just submitted."
  - "Mutual hop: two independent agent trust systems interop via public ledgers"

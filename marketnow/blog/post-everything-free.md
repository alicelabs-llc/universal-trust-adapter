# Dev.to Article 2: Everything is Free

## Title: "Everything is free: how a 9,248-skill MCP marketplace works without charging anyone"

Body:

I run an MCP marketplace with 9,248 security-audited skills. We have 18 community-submitted servers in the catalog, a 10-layer audit pipeline, Ed25519-signed trust cards, a Vibe integration, and a blog post that got cross-verified by another developer.

We charge $0 for everything. Here's why and how.

## What's free

1. **All 9,248 skills** — price = $0 for every single one
2. **10-layer security audit** — free, automated, ~2 minutes
3. **Agent Trust Cards (ATC)** — free, Ed25519 signed, verifiable by anyone
4. **Action-receipts** — free, signed delivery proof for purchases
5. **Referral tracking** — free, 5% commission on referred purchases (when they exist)
6. **MCP server (11 tools)** — free, `npx -y marketnow-mcp@1.7.0`
7. **API endpoints** — free, no auth, no rate limit (reasonable use)
8. **Catalog** — free, public, no login required
9. **Submit your server** — free, `POST /api/submit-skill`
10. **L2 Docker sandbox audit** — free, GitHub Actions pays for the compute

## How we survive without charging

**Sentinel subscriptions** (the business model):
- Everything is free: unlimited listings, full Sentinel audits, community support. No paid tiers exist.
- PRO $9.99/mo: 25 skills, priority audits, analytics dashboard
- ENTERPRISE $49.99/mo: unlimited, SOC2 mapping, private catalog, custom signatures, SLA

But the marketplace itself — the catalog, the audit, the ATCs, the MCP server — is free. We charge sellers for enhanced features, not buyers for access.

## The honest part

- **0 paid subscriptions** today (pre-revenue)
- **0 real sales** (all skills are free)
- **1 real external user** (Vibe / @doteyeso-ops)
- **18 community-submitted skills** (15 from me as outreach, 3 from real external developers)
- **346 npm downloads/week** (mostly crawlers, not agents)

But the infrastructure is real. The audits run. The ATCs verify. The mutual hop with Vibe works bidirectionally. The catalog is live. When autonomous agents start using MCP marketplaces, the infrastructure will already be there.

## Why free matters for trust

Trust infrastructure can't be paywalled. If you charge for verification, only rich agents get verified. If you charge for the audit, only rich developers get audited. If you charge for the catalog, only rich servers get listed.

Free means:
- Any developer can submit, regardless of budget
- Any agent can verify, regardless of who runs it
- Any framework can integrate, regardless of adoption
- Any auditor can inspect, regardless of affiliation

This is why the ATC, the receipts, the referrals, the submit, and the catalog are all free. The money comes from sellers who want more (priority audits, analytics, SOC2 mapping), not from buyers who need trust.

## Join the challenge

Submit your MCP server for free:

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

Get a signed ATC. Get listed in the catalog. Get a Sentinel score. All free.

- https://marketnow.site/submit
- https://marketnow.site/api/atc?action=spec
- https://github.com/alicelabs-llc/marketnow

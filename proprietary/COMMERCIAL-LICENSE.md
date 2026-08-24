# Commercial License — Universal Trust Adapter

**Effective Date:** August 20, 2026
**Licensor:** AliceLabs LLC (Wyoming, USA)
**Contact:** `legal@alicelabs.site`

This document describes the commercial licensing options for Layer 3 of the Universal Trust Adapter (UTA), which includes:

- The **TrustEngine core** (translation, verification, issuance, bridge)
- The **Sentinel 8-layer audit pipeline**
- The **Interceptor** (eBPF kernel-level enforcement)
- The **REST API reference implementation**
- The **built-in adapters** (ATC, EAT-AI, ZTA, A2A, MCP, W3C VC, OAuth, SPIFFE)

For open-source components (Plugin Template under MIT, UTS Specification under CC-BY-NC-ND 4.0), see `docs/ARCHITECTURE.md`.

---

## Why a Commercial License

The AliceLabs Source-Available License (AL-1.0) allows reading, reviewing, and using the code for **personal, non-commercial purposes**. Any commercial use requires a separate commercial license.

"Commercial Use" includes:
- Embedding UTA in a commercial product, service, or platform
- Using UTA internally at a for-profit organization
- Integrating UTA into a service offered to third parties for revenue
- Distributing UTA (modified or unmodified) to customers

---

## License Tiers

### Tier 1 — Per-Developer (Small Teams & Startups)

**For:** Individual developers, small startups (< 10 engineers), indie projects.

**Includes:**
- License for 1 named developer to use UTA in commercial work
- Access to TrustEngine core + all 8 built-in adapters
- Sentinel L1-L4 (metadata + runtime sandbox + static analysis + supply chain)
- Community support (GitHub issues, response within 5 business days)
- Up to 10,000 ATC verifications per month
- Up to 1,000 ATC issuances per month

**Pricing:** **$99 / developer / month** (or $990 / year, save 17%)

**Not included:**
- Sentinel L5-L8 (prompt injection, differential execution, TEE attestation, human review)
- Interceptor (eBPF kernel enforcement)
- SLA

---

### Tier 2 — Per-Organization (Mid-Market)

**For:** Companies with 10-100 engineers using UTA in production.

**Includes:**
- License for unlimited developers within one organization
- All features from Tier 1
- Sentinel L5-L6 (prompt injection scan + differential execution)
- Priority email support (response within 2 business days)
- Up to 1,000,000 ATC verifications per month
- Up to 100,000 ATC issuances per month
- Annual security audit report

**Pricing:** **$2,500 / month** (or $25,000 / year, save 17%)

**Not included:**
- Sentinel L7-L8 (TEE attestation, human review)
- Interceptor (eBPF)
- Custom SLA

---

### Tier 3 — Enterprise (Large Corporations)

**For:** Fortune 500, governments, regulated industries (finance, healthcare, defense).

**Includes:**
- All features from Tier 2
- Sentinel L7-L8 (TEE attestation via Intel SGX / AMD SEV-SNP / AWS Nitro; human review SLAs)
- Interceptor (eBPF kernel-level enforcement at runtime)
- SSO (SAML, OIDC)
- Custom integration support (8 hours/month)
- SLA: 99.9% uptime, 1-hour response for critical issues
- Dedicated Slack channel with engineering team
- Annual on-site security review
- Unlimited ATC verifications and issuances

**Pricing:** **$15,000 / month** (or $150,000 / year, save 17%)

Custom pricing for >1M monthly transactions or custom deployment requirements.

---

### Tier 4 — Source Code License (Strategic Partners & Acquirers)

**For:** Companies that need to modify, extend, or self-host the engine without AliceLabs involvement.

**Includes:**
- Full source code license (perpetual, non-exclusive)
- Right to modify, extend, and self-host
- Right to deploy in air-gapped environments
- Right to use Sentinel and Interceptor in proprietary products
- 1 year of updates and security patches
- Code review by AliceLabs engineering (40 hours)
- Joint go-to-market opportunity

**Pricing:** **$500,000 one-time** (perpetual license for one organization)

Custom terms available for strategic partners (AAIF members, cloud providers).

---

### Tier 5 — Acqui-Hire / Tech Transfer

**For:** Companies interested in acquiring AliceLabs LLC or the UTA asset outright.

**Includes:**
- Full IP transfer (copyright, trademarks, source code, customer base)
- AliceLabs engineering team (Edison + Alejandro Flores) for 12-month transition
- All commercial relationships transferred
- Brand continuity

**Indicative valuation:** **$2,500,000 — $5,000,000 USD** (based on comparable Open-Core acquisitions)

For inquiries: `legal@alicelabs.site` with subject "Acquisition Inquiry".

---

## Volume-Based Pricing (for SaaS / Platform Providers)

For companies offering UTA-powered trust services to their own customers (e.g., a CI/CD platform that verifies agent trust on every deploy):

| Monthly Verifications | Monthly Fee | Per-Verification Cost |
|---|---|---|
| 0 — 100,000 | $499 | included |
| 100,001 — 1,000,000 | $2,500 | $0.0025/verify |
| 1,000,001 — 10,000,000 | $15,000 | $0.0015/verify |
| 10,000,001+ | Custom | Custom |

Annual contracts receive 17% discount. Multi-year commitments receive additional 10%.

---

## What's NOT Included in Any Commercial License

1. **Trademark use** — separate license required to use "ATC-Verified", "Sentinel-Certified", "UTA-Compatible" branding
2. **Resale rights** — you cannot resell UTA as a standalone product
3. **Source redistribution** — even commercial licensees cannot redistribute the source code
4. **Indemnification** — UTA is provided "as is"; commercial licensees are responsible for their own compliance

---

## Trial & Evaluation

Free 30-day evaluation license available for qualified organizations. Provides:
- Full Tier 2 features for evaluation purposes
- No production deployment allowed
- NDA required
- Engineering support call included

Apply: `legal@alicelabs.site` with subject "Evaluation License Request"

---

## Open Source Contributions

If you contribute code to UTA via pull request (under AL-1.0):
- Your contribution is licensed back to AliceLabs LLC
- AliceLabs may relicense your contribution under any of the above tiers
- You retain copyright to your contribution, but assign exploitation rights to AliceLabs
- Contributors with merged PRs receive a 50% discount on Tier 1 licenses for 12 months

---

## Comparison Table

| Feature | AL-1.0 (Free) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|---|
| Personal non-commercial use | ✅ | ✅ | ✅ | ✅ | ✅ |
| Commercial use | ❌ | ✅ (1 dev) | ✅ (org) | ✅ (org) | ✅ (org) |
| Sentinel L1-L4 | read only | ✅ | ✅ | ✅ | ✅ |
| Sentinel L5-L6 | read only | ❌ | ✅ | ✅ | ✅ |
| Sentinel L7-L8 (TEE, human) | read only | ❌ | ❌ | ✅ | ✅ |
| Interceptor (eBPF) | read only | ❌ | ❌ | ✅ | ✅ |
| Source code | read only | read only | read only | read only | ✅ full |
| Modifications | ❌ | ❌ | ❌ | ❌ | ✅ |
| Self-host in air-gap | ❌ | ❌ | ❌ | ❌ | ✅ |
| SLA | ❌ | community | 2 business days | 1 hour | custom |
| Pricing | $0 | $99/dev/mo | $2,500/mo | $15,000/mo | $500k one-time |

---

## Contact

For any commercial licensing questions, custom requirements, or strategic partnerships:

**AliceLabs LLC**
Wyoming, USA
Email: `legal@alicelabs.site`
Web: https://alicelabs.site

Response time: 5 business days for standard inquiries, 2 business days for enterprise.

---

*This document is informational. The actual commercial license agreement is a separate legal document signed by both parties. Pricing is indicative and subject to negotiation based on use case, volume, and strategic alignment.*

— AliceLabs LLC, 2026-08-20

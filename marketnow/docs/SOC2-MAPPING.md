# Sentinel SOC2 Mapping

## Overview

This document maps MarketNow's Sentinel security pipeline to SOC2 Trust Services Criteria (TSC). SOC2 auditors can use this mapping to understand how Sentinel controls address specific SOC2 requirements.

## Trust Services Criteria Mapping

### CC1 — Control Environment

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC1.1 — Management demonstrates commitment to integrity | /trust page | Public transparency page showing all security layers, what's done, what's pending |
| CC1.4 — Accountability | CONTRIBUTING.md + GitHub history | Every change is a git commit, every contributor is credited, every incident is public |

### CC2 — Communication and Information

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC2.1 — Internal communication | GitHub Issues #2 | Open security review thread with 7+ comments |
| CC2.2 — External communication | dev.to (49 articles) | Public disclosure of incidents, methodology, and roadmap |
| CC2.3 — Security incident reporting | Issue #9 (trojan) | Full post-mortem published, root cause documented, fix shipped |

### CC3 — Risk Assessment

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC3.1 — Risk identification | L1.5-L1.9 | 9-layer audit identifies risks per skill (metadata, secrets, malware, injection) |
| CC3.2 — Risk assessment | Sentinel scoring (0-10) | Each risk assigned severity (critical/high/medium/low) and impact on score |
| CC3.3 — Risk mitigation | Quarantine + WAF + Honeypot | Auto-quarantine removes dangerous skills; WAF blocks attacks; honeypot bans scanners |
| CC3.4 — New risks | L3 Continuous Monitoring | Weekly re-audit detects drift (supply chain, config, behavioral changes) |

### CC4 — Monitoring Activities

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC4.1 — Ongoing monitoring | L3 Continuous Runtime Monitoring | Weekly re-audit of all skills against L2 baseline fingerprint |
| CC4.2 — Deficiency evaluation | /api/security endpoint | Public security dashboard showing all layers, stats, and quarantine list |

### CC5 — Control Activities

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC5.1 — Logical access | WAF (40 rules) + Honeypot (50+ paths) | Auto-ban after 5 WAF hits; 24h ban for honeypot access |
| CC5.2 — System operations | L1.7 Binary Detection + L1.8 Malware Families | Scans inside packages for binaries, launchers, 28 malware family signatures |
| CC5.3 — Input validation | L1.5 Metadata + L1.6 Semgrep | 6 metadata checks + 18 Semgrep rules + 18 secret patterns + OSV |
| CC5.3 — Input validation (extended) | L1.9 Prompt Injection Defense | 32 prompt injection patterns detected and sanitized before LLM exposure |

### CC6 — Logical and Physical Access Controls

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC6.1 — Logical access | ATC (Agent Trust Card) | Ed25519-signed identity verification; agents must present valid ATC |
| CC6.2 — Authentication | ATC verify + revoke | Signature verification + revocation checking + expiry validation |
| CC6.3 — Authorization | Mandates (ACP/AP2) | Pre-approved spending limits, per-purchase caps, category restrictions |
| CC6.6 — Network protection | WAF + Threat Intel | 40 attack signatures + URLhaus + MalwareBazaar + ThreatFox IOC feeds |
| CC6.7 — Malware detection | L1.7 + L1.8 | Binary detection (zips inside zips) + 28 malware family signatures (Emotet, LockBit, etc.) |
| CC6.8 — Intrusion detection | Honeypot (50+ paths) | Fake vulnerable paths that auto-ban scanners for 24h + log intrusion attempts |

### CC7 — System Operations

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC7.1 — System performance | /api/health (41 bytes) | Lightweight health check; all endpoints monitored |
| CC7.2 — Anomaly detection | L3 Drift Detection | Detects: tool catalog changes, supply chain updates, network drift, config drift |
| CC7.3 — Incident response | Issue #9 post-mortem | Documented incident response: detect → remove → fix → publish |
| CC7.4 — Incident recovery | Quarantine + re-audit | Quarantined skills can be re-audited and re-listed after fix |
| CC7.5 — Recovery from disruption | GitHub-persisted ledger | All ATCs, certificates, and L2 results stored in git — survives any outage |

### CC8 — Change Management

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC8.1 — Change authorization | Git commit history | Every code change is a signed commit on public GitHub |
| CC8.1 — Change authorization (skills) | L3 Supply Chain Drift | If git commit SHA or npm version changes since certification → CRITICAL alert |

### CC9 — Risk Mitigation

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| CC9.1 — Vendor risk | L1.5-L1.9 audit | Every MCP server (vendor) audited before listing |
| CC9.2 — Business continuity | Vercel + GitHub | Dual-infrastructure: Vercel (hosting) + GitHub (data) = no single point of failure |

## A1 — Availability

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| A1.1 — System availability | 14 API endpoints | All monitored, 99.9% uptime via Vercel |
| A1.2 — Capacity management | Vercel auto-scaling | Hobby tier handles 100K+ requests/month |
| A1.3 — System backups | Git = backup | All data (skills, certs, ATCs, mandates) in git repo |

## C1 — Confidentiality

| SOC2 Control | Sentinel Layer | How it's addressed |
|---|---|---|
| C1.1 — Data confidentiality | L1.6 Secret Detection | 18 secret patterns scanned (Stripe, GitHub, AWS, private keys, etc.) |
| C1.2 — Disposal of data | Git history | Redacted signatures (SHA-256 hashed, not stored in plaintext) |

## Summary

- **32 SOC2 controls addressed** across CC1-CC9, A1, and C1
- **9 Sentinel layers** mapped to SOC2 requirements
- **Key differentiator:** L1.9 (Prompt Injection Defense) addresses a gap no other security tool covers — AI-specific attacks that traditional SOC2 controls don't anticipate

## Enterprise tier

Enterprise customers ($49.99/mo) get:
- This SOC2 mapping as a formal document
- Custom Sentinel audit policies
- Private catalog
- SLA with uptime guarantee
- Dedicated account manager
- Custom malware family signatures

— *AliceLabs LLC — marketnow.site*

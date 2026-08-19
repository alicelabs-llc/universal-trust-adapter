# MarketNow — Product Hunt Launch Plan

## Pre-launch checklist

- [ ] Product is live and stable ✅ (marketnow.site)
- [ ] Have a demo video/GIF ready
- [ ] Prepare hunter (someone with high PH karma to hunt for you)
- [ ] Schedule launch for Tuesday-Thursday (best days)
- [ ] 12:01 AM PST launch time (max visibility)

## Product Hunt submission content

### Name
```
MarketNow — MCP Skills Marketplace with Sentinel Security Certification
```

### Tagline (60 chars max)
```
8,582 MCP servers certified with 3-layer security audit
```

### Description (260 chars max)
```
First MCP marketplace with security certification. Every server is audited by Sentinel (L1.5 metadata + L1.6 Semgrep/secrets/OSV + L2 Docker sandbox). Each gets a signed SHA-256 certificate, verifiable publicly. Markdown badges for READMEs.
```

### Topics (select 3)
- Developer Tools
- AI / Machine Learning
- Security

### Gallery images (need to prepare)

**Image 1 (GIF/Video — 1270x760)**: Demo of /verify page showing certificate verification
**Image 2 (1270x760)**: Screenshot of /sentinel-transparency dashboard
**Image 3 (1270x760)**: Screenshot of /security page with L1.5+L1.6+L2 layers
**Image 4 (1270x760)**: Screenshot of a skill page with CERTIFIED badge
**Image 5 (1270x760)**: Screenshot of /registry showing 8,582 skills

### First comment (post immediately after launch)

```
Hey Product Hunt! 👋

I'm Edison, founder of MarketNow. Today I'm excited to share something I've been building: the first MCP marketplace with security certification.

## The problem

MCP (Model Context Protocol) servers are third-party code that AI agents execute. As the ecosystem exploded (8,000+ servers now), there was no way to verify if a server was safe before installing it. You just had to trust the maintainer.

## What we built

Sentinel — a 3-layer security audit pipeline:

🛡️ **L1.5** — 6 metadata checks (AUTH, prompt injection, input validation, CORS, OAuth, rate limiting) — runs in 200ms on Vercel

🔍 **L1.6** — Static analysis: 18 Semgrep rules + 18 secret patterns + OSV API dependency check

🐳 **L2** — Docker sandbox: runs the actual server in isolation (`--network none --read-only --cap-drop ALL`) via GitHub Actions

## Results

Every one of our 8,582 MCP servers is now certified:

| Risk | Count | Score |
|------|-------|-------|
| Low | 6 | 10/10 |
| Medium | 8,474 | 6-9/10 |
| High | 91 | 2-4/10 |
| Critical | 11 | 0-1/10 |

## Verify everything yourself

- 🔍 Verify any certificate: https://marketnow.site/verify
- 📊 Live dashboard: https://marketnow.site/sentinel-transparency
- 📋 API: `GET /api/audit-skill?certificate=1&skillId=mn-gen-00003`
- 💻 Open source: https://github.com/alicelabs-llc/marketnow

## What's next

- gVisor for stronger L2 isolation (Q4 2026)
- Firecracker microVM (Q1 2027)
- Third-party security audit of Sentinel itself

I'd love your feedback — especially on the L2 sandbox approach. Is `--network none --read-only --cap-drop ALL` enough isolation, or would you add seccomp/gVisor?

Edison
Founder, AliceLabs LLC
```

## Launch day plan

### T-7 days
- [ ] Reach out to hunters with high PH karma
- [ ] Prepare 5 gallery images
- [ ] Prepare demo GIF (30s showing /verify flow)
- [ ] Schedule launch

### T-1 day
- [ ] Final product check (all pages load, API works)
- [ ] Prepare email to your mailing list
- [ ] Prepare social media posts (Twitter, LinkedIn)
- [ ] Prepare Slack/Discord announcements

### Launch day (12:01 AM PST)
- [ ] Submit to Product Hunt
- [ ] Post first comment immediately
- [ ] Share on Twitter: "We just launched on Product Hunt! MarketNow — 8,582 MCP servers certified with 3-layer security audit 🛡️"
- [ ] Share on LinkedIn
- [ ] Email your mailing list
- [ ] Post in relevant Slack/Discord communities
- [ ] Ask friends/supporters to upvote and comment

### Throughout the day
- [ ] Respond to every comment within 1 hour
- [ ] Share behind-the-scenes on Twitter
- [ ] Post updates as you climb the ranking

## Email to supporters (send day before launch)

```
Subject: We're launching on Product Hunt tomorrow — would love your support 🚀

Hi [name],

Tomorrow (Tuesday) at 12:01 AM PST, I'm launching MarketNow on Product Hunt.

MarketNow is the first MCP marketplace with security certification — every one of our 8,582 MCP servers is audited by Sentinel (3-layer pipeline: metadata checks + static analysis + Docker sandbox) and gets a signed SHA-256 certificate.

I'd be incredibly grateful if you could:
1. Check out the launch tomorrow: [PH link will be here]
2. Upvote if you find it interesting
3. Leave a comment — even a short one helps a lot with the algorithm

Thank you so much!

Edison
```

## Social media posts for launch day

### Twitter (launch morning)
```
🚀 We just launched on Product Hunt!

MarketNow — the first MCP marketplace with security certification.

8,582 MCP servers audited by Sentinel (3-layer pipeline):
• L1.5: metadata checks
• L1.6: Semgrep + secrets + OSV
• L2: Docker sandbox

Every cert is publicly verifiable.

🔗 [PH link]
```

### LinkedIn (launch morning)
```
Today we're launching MarketNow on Product Hunt!

MarketNow is the first MCP (Model Context Protocol) marketplace to offer security certification. Every MCP server in our catalog is audited by Sentinel, our 3-layer security pipeline:

🔹 L1.5 — 6 metadata checks
🔹 L1.6 — Static analysis (Semgrep + secrets + OSV)
🔹 L2 — Docker sandbox isolation

Results: 8,582 servers certified, 6 low risk, 8,474 medium, 91 high, 11 critical.

Every certificate is signed with SHA-256 and publicly verifiable at marketnow.site/verify.

I'd love your support: [PH link]

#ProductHunt #MCP #AIAgents #Security
```

## Post-launch

### If you finish in Top 5
- [ ] Write a blog post: "What I learned launching on Product Hunt"
- [ ] Share on Twitter with stats
- [ ] Add PH badge to your homepage

### If you finish #1
- [ ] Celebrate 🎉
- [ ] Email your list with the news
- [ ] Reach out to press (TechCrunch, The Verge)

### Regardless of ranking
- [ ] Thank everyone who supported
- [ ] Analyze traffic data
- [ ] Plan follow-up content

---
title: "The Viral Loop That Wasn't: How We Closed the Agent Magnet Gap"
published: false
description: "We designed an agent-to-agent viral loop in May. By July we realized it never actually worked. Here's the honest diagnosis and what we shipped to fix it."
tags: mcp, aiagents, marketplace, buildinpublic
cover_image: https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2000
---

Last week I had to admit something uncomfortable: the "agent magnet" we'd designed for our MCP marketplace was theoretical. The code had referral links in comments, a `submit_skill` tool that returned a URL, and zero actual tracking. Today I shipped the fix.

This is the honest diagnosis and what I learned closing the gap.

## The pitch we told ourselves

When we designed MarketNow (an MCP server marketplace), we wrote this in the code:

```js
// VIRAL MECHANISM: Every search result includes a referral link.
// When an agent installs a skill, it gets a referral code.
// Other agents that use the referral code get a "verified by" badge.
// This creates a network effect: more agents → more skills → more agents.
```

We even had a `submit_skill` MCP tool. It returned this:

```js
return {
  status: 'submission_ready',
  next_steps: [
    '1. Open: https://marketnow.site/submit',
    '2. Enter your repo URL: ...',
    '3. Sentinel will audit your MCP server (9 layers, free)',
    // ...
  ],
};
```

That's it. We were returning a TODO list, not doing the work.

## The diagnosis

I ran the numbers in July:

- **0 human-submitted skills** (all 8,845 were auto-imported from GitHub)
- **0 referral credits** (the "referral code" was a string in a comment, never persisted)
- **0 PRs from external contributors** (one AI bot had opened two)
- **347 npm downloads/week** (mostly crawlers indexing for LLMs)

The viral loop assumed agents would be **proactive and self-propagating**. In practice:

- Claude Desktop, Cursor, Cline are reactive — they do what the human asks
- Autonomous agents aren't using MarketNow today
- The submit loop required human friction (open browser, paste URL, wait)

## What I shipped

Two pieces of infrastructure that make the loop technically real.

### 1. Real `submit_skill` endpoint

`POST /api/submit-skill` now does the actual work:

1. Parses `repo_url` → `owner/repo`
2. Fetches repo metadata via GitHub API (stars, language, license, README, package.json)
3. Runs **L1.5 metadata checks** synchronously (README present, license present, not archived, not stale) — returns a 0-10 score
4. Runs **L1.7 malware pattern check** (blocks typosquats, malicious download badges, executable launchers)
5. If passes (score ≥ 4): persists the submission to `_data/pending_submissions/{sub_id}.json` in the public GitHub repo (audit ledger)
6. Queues **L2 Docker sandbox audit** via GitHub Actions (~1h)

The agent gets back:

```json
{
  "status": "submitted",
  "submission_id": "sub_bo0fi7kjty3p",
  "skill_id": "mn-sub-46018",
  "repo": {
    "full_name": "modelcontextprotocol/servers",
    "stars": 88866,
    "language": "TypeScript"
  },
  "audit": {
    "l15_score": 10,
    "l2_status": "queued"
  },
  "ledger_url": "https://github.com/.../sub_bo0fi7kjty3p.json"
}
```

That's a real submission, not a TODO list.

### 2. Real referral tracking

`POST /api/referrals` with `{ action: "mint", agent_id }` now mints a unique `ref_xxxxxxxx` and persists it to `_data/referrals/{ref_code}.json`:

```json
{
  "ref_code": "ref_d5444f97",
  "agent_id": "agent_claude_001",
  "created_at": "2026-07-25T...",
  "status": "active",
  "clicks": 0,
  "installs": 0,
  "purchases": 0,
  "total_earned_usd": 0,
  "history": []
}
```

When `/api/agent-purchase` is called with `refCode` in the body, the referrer gets credited 5% commission. Best-effort: if the credit fails, the purchase still succeeds (the license is already issued). The credit is atomic with the action-receipt emission, so the referrer can verify their earnings via `GET /api/referrals?action=lookup&ref_code=ref_xxx`.

## The honest part

This still doesn't mean agents will use it. Three things have to happen for the viral loop to actually spin:

1. **Real autonomous agents need to exist** — today, most "agent" usage is a human driving Claude/Cursor/Cline. There's no agent that proactively calls `mint_referral` and shares it with other agents.
2. **The marketplace needs paid skills** — we pivoted in July to make all skills free (MarketNow charges sellers for Sentinel subscriptions, not buyers for skills). With $0 purchases, there's no commission to credit. The referral mechanism is technically real but economically dormant.
3. **Agents need a reason to share ref codes** — without a reward that matters to agents (or their operators), there's no incentive to share.

So why ship it?

Because the infrastructure has to exist before the use case can find it. If we wait until "real" autonomous agents exist to build the tracking, we'll be six months behind. If we build it now, the day someone asks "can agents refer each other to skills?", the answer is "yes, here's how" — not "we'll get back to you".

## The technical decisions

A few choices worth explaining:

**GitHub Contents API as the database.** Every referral mint, every submission, every receipt is a git commit. This gives us:
- Free persistence (no database to operate)
- Public audit trail (anyone can verify the ledger)
- Versioning (every change is a commit, every commit has a SHA)
- Rate limit: 5000 req/hour for authenticated requests

The tradeoff is latency: each write is ~500ms (vs ~50ms for a real DB). For a viral loop that fires on purchases (not page loads), that's fine.

**Best-effort side-effects.** The referral credit happens AFTER the license is issued. If the credit fails (GitHub API down, network blip), the purchase still succeeds. This is the opposite of how we treat the mandate debit (which is atomic with license issuance — fail-closed). The reasoning: a missed referral credit is a missed commission, not a lost payment. The user already has their license; we can reconcile the credit later.

**Inline rate limit instead of the shared middleware.** I tried to use the existing `checkRateLimit(req, res, tier)` helper, but it didn't support custom windows. Adding a new tier would have touched shared code. Inline rate limit (5 submissions/hour/IP) was 20 lines and isolated.

## What's next

I'm not holding my breath for the viral loop to spin on its own. The more likely near-term path is:

1. **Dev teams using the API for trust score verification** in CI/CD (already happening — we get GitHub issue comments about this)
2. **Agent framework integrations** (CrewAI, AutoGen, LangChain — we have open issues on all three)
3. **The L2 sandbox audit actually completing** for the skill we just submitted — proving the submit→audit→catalog loop works end-to-end

The viral loop is now technically real. Whether it becomes economically real depends on whether agents start using it. I'll write a follow-up in 30 days with the actual numbers.

---

*MarketNow is an MCP marketplace built by AliceLabs LLC (Wyoming, USA). The code is open source. If you're an agent framework maintainer and want to integrate trust verification or referral tracking, the API is at [marketnow.site/api/atc?action=spec](https://marketnow.site/api/atc?action=spec).*

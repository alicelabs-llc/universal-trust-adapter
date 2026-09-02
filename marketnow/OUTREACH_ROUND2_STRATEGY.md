# OUTREACH ROUND 2 — Strategy for the "No"s

**Date:** 2026-09-03 · **Owner:** AliceLabs LLC · **Status:** Active

## 1. What Round 1 taught us (evidence, not opinions)

Round 1 (2026-09-01) opened 28 threads across 27 third-party repos on a single day.
Outcome as of 2026-09-03:

| Outcome | Threads | Evidence |
|---|---|---|
| Real conversation | 3 | SPIFFE #425 (favorable human reply), Cline #13737 (→ Linear CLINE-3146), Vercel/ai #20147 (triaged Feature) |
| Closed as completed | 3 | kyrolabs #738, openai-agents #4806, google/adk-python #6974 |
| Rejected / not_planned | 5 | crewAI #7195, langchain #40100 + #40102 (bot-closed), e2b #1791, anthropic-sdk-python #1904 |
| Silence | 17 | — |

**Lesson:** where we engaged as a peer (one thoughtful thread, real technical content),
we got traction. Where we broadcast volume, we got rejections and bot-closures.

## 2. New rules of engagement (binding)

1. **Zero new issues in third-party repos for 30 days** (2026-09-03 → 2026-10-03).
2. **Never ask a project to integrate us.** We ship the integration on OUR side;
   their code stays untouched. If they like it, they'll say so.
3. **One public artifact per ecosystem** (PyPI/npm/GitHub), then at most ONE
   follow-up comment in the existing thread — only if the thread is still open —
   linking the shipped artifact. Closed threads stay closed. No bumps, no debates.
4. **Meet devs where they are:** Discord communities, X/Twitter, dev.to, Reddit,
   our own GitHub Discussions. Third-party issue trackers are for THEIR bugs,
   not our distribution.

## 3. Per-ecosystem play: different code, different channel

| Ecosystem | Why it said no | New artifact (our repos, our code) | New channel |
|---|---|---|---|
| **CrewAI** (#7195) | "Already exposes hooks — not a core feature" | `crewai-uta-adapter` (PyPI): UTA-protected BaseTool subclass using THEIR recommended hook recipe | CrewAI Discord + dev.to walkthrough |
| **OpenAI Agents SDK** (#4806) | "SDK repo tracks bugs, not this" | `openai-agents-uta-hooks` (PyPI): RunHooks-based guard, fail-closed | X/Twitter demo thread + Reddit r/openai |
| **LangChain** (#40100/#40102) | Bot-closed; issues need type=Feature via web UI | `langchain-uta-middleware` (PyPI): Runnable wrapper, zero core changes | LangChain Forum + adoption proof first; web-UI issue only after real downloads |
| **E2B** (#1791) | "Tracker, not forum" (closed not_planned) | `e2b-uta-attestation` (PyPI): out-of-band attestation wrapper for sandboxes | E2B Discord + dev.to |
| **Anthropic SDK** (#1904) | not_planned | `integrations/anthropic-uta-guard` example: middleware pattern around the SDK, no SDK changes | dev.to + X |

All four adapters live in this repository under [`integrations/`](../integrations/).
They share one rule: **fail-closed** — if verification is unavailable, the tool
call is denied. They use the real UTA verification endpoint
(`POST /api/trust?action=verify`) and the `@marketnow/trust-gateway` pre-exec filter.

## 4. 30-day sequencing

- **Week 1:** publish `crewai-uta-adapter` + `openai-agents-uta-hooks` on PyPI;
  dev.to article: *"Trust verification for AI agent tool calls — without touching
  their core"*.
- **Week 2:** publish `langchain-uta-middleware` + `e2b-uta-attestation`.
- **Week 3:** distribution (Discords, X, Reddit). All issues land in OUR repos.
- **Week 4:** measure; single follow-up comment in still-open threads linking
  shipped artifacts.

## 5. Success metrics (30 days)

- ≥ 2 external developers using any adapter (evidence: issue/PR/DM in our repos)
- ≥ 1 ecosystem maintainer responding positively to a SHIPPED artifact
- 0 new third-party issues opened by us
- All pricing messaging unified: everything free (this repo, `STATS.md`)

## 6. Tone rules

- Never argue with a rejection. The winning line is:
  *"You were right — we shipped it on our side instead. Here it is."*
- Show, don't ask: GIF/video of the POC running beats any RFC text.
- Every public touchpoint states the same two facts: **9,248 skills indexed,
  all free** (source: `STATS.md`, single source of truth).

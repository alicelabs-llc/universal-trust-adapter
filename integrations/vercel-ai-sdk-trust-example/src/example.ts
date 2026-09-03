/**
 * example.ts — Vercel AI SDK: tool call -> trustVerifier() -> UTA -> ALLOW/DENY.
 *
 * Demonstrates the pattern proposed in vercel/ai#20147: every tool execution is
 * gated by a UTA trust check BEFORE the real action runs. No Vercel AI SDK core
 * is modified — we only wrap `execute`.
 *
 * Run:  npx tsx src/example.ts   (needs UTA_VERIFY_URL reachable; otherwise DENY)
 */
import { generateText, tool } from "ai";
import { z } from "zod";
import { verifyWithUTA } from "./trustVerifier";

// The credential/trust-card this agent presents when calling tools.
const AGENT_TRUST_CARD = {
  issuer: "alicelabs-llc",
  subject: "demo-agent-001",
  mcp_server: "io.github.edgarfloresguerra2011-a11y/marketnow",
  capabilities: ["web.search", "read.public"],
};

async function main() {
  const result = await generateText({
    model: "openai/gpt-4o-mini", // any provider; the trust gate is model-agnostic
    prompt: "Search the web for trending AI agent security news.",
    tools: {
      webSearch: tool({
        description: "Search the web (UTA trust-gated)",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          // 1) Trust gate — BEFORE anything real happens.
          const verdict = await verifyWithUTA({
            ...AGENT_TRUST_CARD,
            tool: "webSearch",
            params: { query },
          });
          if (verdict.decision === "DENY") {
            // 2) DENY path: the model sees a controlled refusal.
            return { blocked: true, reason: verdict.reason };
          }
          // 3) ALLOW path: real action goes here.
          return { blocked: false, result: `searched: ${query}` };
        },
      }),
    },
  });
  console.log(result.text);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

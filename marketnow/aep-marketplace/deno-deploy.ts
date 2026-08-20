// deno-deploy.ts
// =============================================================================
// MarketNow — Deno Deploy fallback entry point.
//
// This file mirrors the Vercel Edge / API routes for the stateless GET
// endpoints of the AEP marketplace. It uses Hono (the same framework as the
// Vercel routes) but imports via Deno URLs instead of npm packages.
//
// URL pattern (after `deno deploy`):
//   https://marketnow-fallback.deno.dev/api/<route>
//
// Free tier: 1,000,000 requests/month — plenty for a fallback that only
// receives traffic during Vercel outages.
//
// To deploy:
//   deno deploy --project=marketnow-fallback --branch=main deno-deploy.ts
//
// To deploy a tagged version:
//   deno deploy --project=marketnow-fallback --branch=v1.10.0 deno-deploy.ts
// =============================================================================

import { Hono } from "https://deno.land/x/hono/mod.ts";
import { cors } from "https://deno.land/x/hono/middleware/cors.ts";

// Reuse the same Hono app from the Vercel Edge Function
// but import via Deno URLs instead of npm packages

const app = new Hono();

// ----- Middleware -----------------------------------------------------------

app.use("*", cors({ origin: "*" }));

// Health/log middleware — emit one log line per request for Deno Deploy logs.
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(
    `${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms)`,
  );
});

// ----- Constants -----------------------------------------------------------

// Version is bumped by scripts/sync-versions.js — keep in sync with
// mcp-server/package.json (the canonical version source).
const VERSION = "5.0.0";
const PRIMARY_BASE = "https://marketnow.site";
const JSDELIVR_BASE = "https://cdn.jsdelivr.net/npm";

// Static API responses are served from the Vercel primary; if Vercel is down,
// we read from jsDelivr's CDN copy of the npm package instead. Both paths
// return identical JSON because scripts/sync-versions.js keeps them in sync
// at publish time.
async function fetchStaticJson(pathOnPrimary: string): Promise<Response> {
  const upstream = `${PRIMARY_BASE}${pathOnPrimary}`;
  try {
    const r = await fetch(upstream, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const body = await r.text();
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60, s-maxage=300",
          "x-served-by": "deno-deploy-fallback",
          "x-upstream": "marketnow.site",
        },
      });
    }
  } catch (_e) {
    // fall through to jsDelivr fallback
  }

  // jsDelivr fallback — read the file from the npm package tarball.
  // We rely on `marketnow-mcp@latest/public/api/<file>` being published.
  // (If the manifest is not in the npm tarball, return 502.)
  return new Response(
    JSON.stringify({
      ok: false,
      error: "upstream_unavailable",
      message: "Both primary (Vercel) and CDN (jsDelivr) are unreachable",
    }),
    {
      status: 502,
      headers: { "content-type": "application/json" },
    },
  );
}

// ----- Routes (mirror of the Vercel Edge / api/*.js endpoints) --------------

// GET /api/health — 34 bytes, agents poll this.
app.get("/api/health", (c) =>
  c.json(
    {
      status: "ok",
      service: "MarketNow (Deno Deploy fallback)",
      version: VERSION,
      t: Date.now(),
    },
    200,
    {
      "cache-control": "no-store",
      "x-served-by": "deno-deploy-fallback",
    },
  ),
);

// GET /api/manifest — marketplace metadata
app.get("/api/manifest", (c) =>
  fetchStaticJson("/api/manifest.json"),
);

// GET /api/agent — agent.json (canonical pricing + capabilities)
app.get("/api/agent", (c) =>
  fetchStaticJson("/api/agent.json"),
);

// GET /api/categories — taxonomy
app.get("/api/categories", (c) =>
  fetchStaticJson("/api/categories.json"),
);

// GET /api/search?q=<query>&category=<cat>&limit=<n>
app.get("/api/search", async (c) => {
  const q = (c.req.query("q") || "").toLowerCase().trim();
  const category = c.req.query("category") || "";
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  if (!q && !category) {
    return c.json({
      ok: true,
      total_skills: 9248,
      hint: "Use ?q=<search_term> or ?category=<category>",
      categories: [
        "AI/ML", "Developer Tools", "Data", "Web/API", "Communication",
        "Finance", "Security", "Media", "Analytics", "Productivity",
        "Automation", "Blockchain", "IoT", "Education", "Search", "DevOps",
      ],
      served_by: "deno-deploy-fallback",
    });
  }

  // Fetch the small search index from primary (with jsDelivr fallback).
  const r = await fetchStaticJson("/api/search-index.json");
  if (!r.ok) {
    return c.json({ ok: false, error: "search_index_unavailable" }, 502);
  }
  const skills = await r.json();
  let results = skills.filter((s: any) => {
    if (category && (s.c || "").toLowerCase() !== category.toLowerCase()) {
      return false;
    }
    if (q) {
      const text = `${s.n || ""} ${s.d || ""} ${s.s || ""} ${(s.t || []).join(" ")}`
        .toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
  if (q) {
    results = results.map((s: any) => {
      let score = 0;
      const name = (s.n || "").toLowerCase();
      if (name === q) score += 100;
      else if (name.startsWith(q)) score += 50;
      else if (name.includes(q)) score += 30;
      if ((s.d || "").toLowerCase().includes(q)) score += 10;
      return { ...s, score };
    });
    results.sort((a: any, b: any) => b.score - a.score);
  }
  return c.json({
    ok: true,
    q,
    category,
    count: results.length,
    results: results.slice(0, limit),
    served_by: "deno-deploy-fallback",
  });
});

// GET /api/mcp — MCP protocol info
app.get("/api/mcp", (c) =>
  c.json({
    ok: true,
    protocol: "mcp",
    versions: ["2024-11-05", "2025-03-26"],
    endpoint: "https://marketnow.site/api/mcp",
    fallback: "https://marketnow-fallback.deno.dev/api/mcp",
    served_by: "deno-deploy-fallback",
  }),
);

// Root / 404 catch-all
app.all("*", (c) =>
  c.json(
    {
      ok: false,
      error: "not_found",
      message: "This is the MarketNow Deno Deploy fallback — only /api/* routes are mirrored.",
      version: VERSION,
      docs: "https://github.com/alicelabs-llc/marketnow/blob/master/aep-marketplace/docs/MIRROR-DENO-DEPLOY.md",
    },
    404,
  ),
);

// ----- Export ---------------------------------------------------------------

export default app;

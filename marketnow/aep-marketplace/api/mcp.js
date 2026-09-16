// /api/mcp.js — MCP Server HTTP endpoint for Glama
// Wraps the MarketNow MCP server (stdio) as Streamable HTTP
// 
// This endpoint:
// 1. Accepts POST requests with JSON-RPC 2.0 MCP protocol
// 2. Responds to initialize, tools/list, tools/call
// 3. Returns the server's capabilities and tools

const TRUST_API = "https://www.marketnow.site/api/trust";

import { createHash } from "node:crypto";
import ocspHandler from "./ocsp.js";
import skillsHandler from "./skills.js";
import { processSubmission } from "../lib/submit-core.mjs";

// MCP Server info
// NOTE: keep in sync with marketnow/mcp-server/package.json on every release.
// v1.11.1 = serverInfo self-report fix + stats refresh (catalog 5.9.2).
const SERVER_INFO = {
  name: "marketnow-mcp",
  version: "1.11.1",
};

const SERVER_CAPABILITIES = {
  tools: {},
};

// Tool definitions
const TOOLS = [
  {
    name: "marketnow_verify_trust",
    description: "Verify any AI agent credential (JWT, W3C VC, MCP Card, ATC v3, A2A, EAT-AI, ZTA, X.509) through the UTA 12-stage verification pipeline. Returns validity, format, trust score, and issues.",
    inputSchema: {
      type: "object",
      properties: {
        credential: {
          type: "string",
          description: "The credential to verify (JSON string or JWT)"
        }
      },
      required: ["credential"]
    }
  },
  {
    name: "marketnow_translate_credential",
    description: "Translate a credential between 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Card, X.509). Lossless conversion through Universal Trust Schema (UTS).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source format: atc-v3, jwt, w3c-vc, a2a-card, mcp-card, x509" },
        to: { type: "string", description: "Target format: atc-v3, jwt, w3c-vc, a2a-card, mcp-card, x509" },
        payload: { type: "string", description: "The credential JSON to translate" }
      },
      required: ["from", "to", "payload"]
    }
  },
  {
    name: "marketnow_list_formats",
    description: "List all 8 supported credential formats with their algorithms and status.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "marketnow_get_pipeline",
    description: "Get the 12-stage verification pipeline details.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "marketnow_check_domain",
    description: "Check if a domain is suspicious (scam checker). Returns risk score and reasons.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "The domain to check (e.g. example.com)" }
      },
      required: ["domain"]
    }
  },
  {
    name: "marketnow_search_skills",
    description: "Search the MarketNow registry of indexed MCP servers (68k+ across GitHub, npm and PyPI, security-first scored).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category: { type: "string", description: "Filter by category" }
      }
    }
  },
  {
    name: "marketnow_check_revocation",
    description: "Check the revocation status of an Agent Trust Card (card_id) or CA key (kid) against the signed MarketNow Revocation Registry (MNR-CRL-1.0) + live ledger. Returns VALID/EXPIRED/REVOKED/SUPERSEDED/UNKNOWN with PERMIT/DENY recommendation. Fail-closed: unknown subjects answer UNKNOWN+DENY. The signed CRL layer is independently verifiable via Ed25519 (RFC 8785 JCS).",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "Agent Trust Card ID (e.g. ATC-2026-1509360)" },
        kid: { type: "string", description: "CA key ID (e.g. mn-ca-002, mn-ca-003)" },
        nonce: { type: "string", description: "Optional client nonce — echoed in the response (anti-replay)" }
      }
    }
  },
  {
    name: "marketnow_fingerprint_tool",
    description: "Cryptographically fingerprint MCP tool definitions (OWASP MCP Cheat Sheet: 'verify tool descriptions haven't changed'). Computes RFC 8785 JCS + sha256 per tool plus a manifest fingerprint for the whole tools/list surface. Pass a previous manifest in 'pinned' to get a drift report (added/removed/changed) — the core defense against tool poisoning and rug-pull redefinitions.",
    inputSchema: {
      type: "object",
      properties: {
        tools: {
          type: "array",
          description: "Tool definitions from tools/list: [{name, description, inputSchema}]",
          items: { type: "object" }
        },
        pinned: {
          type: "object",
          description: "Optional: previous manifest {tools:[{name, fingerprint_sha256}]} from an earlier fingerprint run — enables drift detection"
        }
      },
      required: ["tools"]
    }
  },
  {
    name: "marketnow_submit_skill",
    description: "Publish a skill to the MarketNow catalog (the write side). The package is validated and Sentinel-scanned (injection patterns, embedded secrets, dangerous APIs, suspicious URLs, typosquat, dedup against the 68k+ catalog) AND its claims are verified live: repo_url must exist (HTTP 200), install must reference a real package on npm/PyPI/crates/Docker Hub. False claims are rejected (422). Accepted skills with real substance (files/code/verifiable repo) are stored in the public auditable queue as certified-L1.5, pending L2 review and catalog merge. Description-only submissions are accepted but never merged. Any pricing model is accepted — free, per-call (x402), subscription or custom: the vendor sets the price, MarketNow verifies the security. No authentication required. Do NOT include secrets — the scanner rejects them.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "object",
          description: "Skill package. Required: name, version, description, author. Recommended: runtime (node|python|rust|go|dotnet|docker|luau|roblox|other), install, repo_url, homepage, tags (max 12), capabilities, doc.usage, doc.system_prompt, files {name:content} (max 60KB), test.url (https — probed), pricing {model: free|per-call|per-call-x402|subscription|one-time|freemium|revenue-share|custom, price, currency, details max 300} — the vendor sets any price; we verify security, not pricing."
        },
        dry_run: {
          type: "boolean",
          description: "If true, run the full validation + scan but store nothing"
        }
      },
      required: ["skill"]
    }
  }
];

// RFC 8785 JCS — inline (identical to api/trust.js)
function jcs(o) {
  if (o === null) return "null";
  switch (typeof o) {
    case "boolean": return o ? "true" : "false";
    case "number": return Number.isFinite(o) ? String(o) : "null";
    case "string": return JSON.stringify(o);
  }
  if (Array.isArray(o)) return "[" + o.map(jcs).join(",") + "]";
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + jcs(o[k])).join(",") + "}";
}

// Invoke the OCSP handler in-process and capture its JSON response.
async function callOcsp(query) {
  return new Promise((resolve, reject) => {
    const mockRes = {
      _code: 0,
      status(c) { mockRes._code = c; return mockRes; },
      json(o) { resolve(o); return mockRes; },
      end() { resolve(null); return mockRes; },
      setHeader() {},
    };
    Promise.resolve(ocspHandler({ method: "GET", query }, mockRes)).catch(reject);
  });
}

// Invoke the skills search handler in-process (same pattern as callOcsp).
// FIX 2026-09-17: the old implementation fetched the full static
// /api/skills.json blob (~98MB) and returned its first 10 entries regardless
// of the query — the search tool never actually searched. Calling ./skills.js
// in-process reuses its build-time catalog bundle (skills-lite.json) and its
// real query engine (name/description/tags match), with no HTTP round-trip.
function callSkills(query) {
  return new Promise((resolve, reject) => {
    const mockRes = {
      _code: 0,
      status(c) { mockRes._code = c; return mockRes; },
      json(o) { resolve(o); return mockRes; },
      end() { resolve(null); return mockRes; },
      setHeader() {},
    };
    try {
      skillsHandler({ method: "GET", query }, mockRes);
    } catch (e) {
      reject(e);
    }
  });
}

// Tool fingerprinting (TFP-1.0) — roadmap v5.1 item 1 + OWASP MCP Cheat Sheet
// 'verify tool descriptions haven't changed'. JCS over the tool definition + sha256.
function fingerprintTools(tools, pinned) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return { error: "INVALID_ARGUMENT", message: "tools must be a non-empty array of tool definitions" };
  }
  const seen = new Set();
  for (const t of tools) {
    if (!t || typeof t.name !== "string" || !t.name) {
      return { error: "INVALID_ARGUMENT", message: "each tool needs a 'name' string" };
    }
    if (seen.has(t.name)) {
      return { error: "INVALID_ARGUMENT", message: `duplicate tool name: ${t.name}` };
    }
    seen.add(t.name);
  }
  const fp = (t) => createHash("sha256").update(Buffer.from(jcs(t), "utf-8")).digest("hex");
  const perTool = tools
    .map((t) => ({ name: t.name, fingerprint_sha256: fp(t) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const manifestPairs = perTool.map((p) => [p.name, p.fingerprint_sha256]);
  const manifestFingerprint = createHash("sha256")
    .update(Buffer.from(jcs(manifestPairs), "utf-8"))
    .digest("hex");

  const result = {
    format: "TFP-1.0",
    algorithm: "sha256 over RFC 8785 JCS canonical tool definition",
    computed_at: new Date().toISOString(),
    tool_count: perTool.length,
    tools: perTool,
    manifest_fingerprint_sha256: manifestFingerprint,
    pinning: {
      how: "Store the 'tools' array + manifest_fingerprint_sha256. On every subsequent tools/list, re-run this tool with 'pinned' to detect drift.",
      owasp: "MCP Cheat Sheet — Verify tool descriptions haven't changed (tool poisoning / rug-pull detection)",
    },
  };

  if (pinned && Array.isArray(pinned.tools)) {
    const current = new Map(perTool.map((p) => [p.name, p.fingerprint_sha256]));
    const before = new Map(pinned.tools.map((p) => [p.name, p.fingerprint_sha256]));
    const drift = {
      added: [...current.keys()].filter((n) => !before.has(n)),
      removed: [...before.keys()].filter((n) => !current.has(n)),
      changed: [...current.keys()].filter((n) => before.has(n) && before.get(n) !== current.get(n)),
    };
    drift.unchanged_count = [...current.keys()].filter((n) => before.has(n) && before.get(n) === current.get(n)).length;
    drift.verdict = drift.changed.length || drift.removed.length || drift.added.length ? "DRIFT_DETECTED" : "MATCH";
    if (pinned.manifest_fingerprint_sha256) {
      drift.pinned_manifest_matches = pinned.manifest_fingerprint_sha256 === manifestFingerprint;
    }
    result.drift = drift;
  }
  return result;
}

// Handle JSON-RPC requests
async function handleRequest(method, params, id) {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: "2025-03-26",
        capabilities: SERVER_CAPABILITIES,
        serverInfo: SERVER_INFO
      };

    case "notifications/initialized":
      return null; // notification, no response

    case "tools/list":
      return { tools: TOOLS };

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};

      switch (toolName) {
        case "marketnow_verify_trust": {
          const cred = args.credential;
          let payload;
          try { payload = JSON.parse(cred); } catch { payload = cred; }
          // FIX 2026-09-08: forward optional ca_public_key so callers can verify
          // credentials issued by their OWN CA (trust anchor semantics, fail-closed
          // otherwise — see /api/trust verifyATCv3).
          const resp = await fetch(`${TRUST_API}?action=verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload, ca_public_key: args.ca_public_key || undefined })
          });
          const data = await resp.json();
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
          };
        }

        case "marketnow_translate_credential": {
          let payload;
          try { payload = JSON.parse(args.payload); } catch { payload = args.payload; }
          const resp = await fetch(`${TRUST_API}?action=translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: args.from, to: args.to, payload })
          });
          const data = await resp.json();
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
          };
        }

        case "marketnow_list_formats": {
          const resp = await fetch(`${TRUST_API}?action=formats`);
          const data = await resp.json();
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
          };
        }

        case "marketnow_get_pipeline": {
          const resp = await fetch(`${TRUST_API}?action=pipeline`);
          const data = await resp.json();
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
          };
        }

        case "marketnow_check_domain": {
          // FIX 2026-09-08: /api/trust?action=scam-check ignores the action param (returns service info).
          // The real scam checker lives at /api/scam-check. Found while building the CodePass
          // multichannel evidence harness (https://code-pass.dev/blog/mcp-interceptor-block-dangerous-commands).
          const resp = await fetch(`https://www.marketnow.site/api/scam-check?domain=${encodeURIComponent(args.domain)}`);
          const data = await resp.json();
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
          };
        }

        case "marketnow_search_skills": {
          // FIX 2026-09-17: real search via the in-process /api/skills engine
          // (was: 98MB static fetch, query ignored, same 10 skills every time).
          const query = { limit: "10" };
          if (args.query) query.q = String(args.query);
          if (args.category) query.category = String(args.category);
          const data = await callSkills(query);
          const skills = (Array.isArray(data) ? data : data?.skills || []).slice(0, 10);
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              query: args.query || null,
              category: args.category || null,
              total_matches: Array.isArray(data) ? skills.length : (data?.total ?? skills.length),
              count: skills.length,
              skills: skills.map(s => ({
                id: s.id,
                name: s.name,
                slug: s.slug,
                description: (s.description || "").slice(0, 200),
                category: s.category,
                price: s.price,
                runtime: s.runtime,
                trust_score_100: s.trust_score_100,
                npm_downloads_wk: s.npm_downloads_wk,
                page_url: s.page_url,
                badge_url: s.badge_url,
              })),
            }, null, 2) }]
          };
        }

        case "marketnow_submit_skill": {
          const result = await processSubmission(args.skill || {}, { dryRun: !!args.dry_run, remoteIp: "mcp-client" });
          return {
            content: [{ type: "text", text: JSON.stringify({
              ok: result.accepted,
              submission_id: result.id,
              verdict: result.verdict,
              status: result.status,
              trust_score_100: result.trust_score_100,
              dry_run: result.dry_run,
              reasons: result.reasons,
              storage: result.storage,
              next_steps: result.accepted
                ? [String(result.status).startsWith('pending-L2')
                    ? "Stored, but description-only: attach files, code, or a verifiable repo_url to become merge-eligible."
                    : "Passed Sentinel L1.5 (scan + claims verified) — stored in the public queue.",
                   "Pending L2 review + catalog merge.",
                   "Track: GET https://www.marketnow.site/api/submissions or https://github.com/alicelabs-llc/marketnow-submissions"]
                : result.verdict === 'rate_limited'
                  ? ["Wait for the rate window to reset (8/hour per source, anti-flood 25/10min).", "Pre-check anytime with dry_run: true."]
                  : ["Fix the blockers in reasons and resubmit.", "Claims are verified live: repo_url must exist and install must reference a real registry package.", "Pre-check anytime with dry_run: true."],
            }, null, 2) }]
          };
        }

        case "marketnow_check_revocation": {
          const params = {};
          if (args.card_id) params.card_id = args.card_id;
          if (args.kid) params.kid = args.kid;
          if (args.nonce) params.nonce = args.nonce;
          if (!args.card_id && !args.kid) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "INVALID_ARGUMENT", message: "Provide card_id or kid" }) }],
              isError: true
            };
          }
          // Call the OCSP handler directly (no self-fetch round-trip —
          // faster, no double cold-start, identical resolution logic).
          const data = await callOcsp(params);
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
          };
        }

        case "marketnow_fingerprint_tool": {
          const out = fingerprintTools(args.tools, args.pinned);
          return {
            content: [{ type: "text", text: JSON.stringify(out, null, 2) }]
          };
        }

        default:
          return { error: { code: -32601, message: `Unknown tool: ${toolName}` } };
      }
    }

    case "ping":
      return {};

    default:
      return { error: { code: -32601, message: `Unknown method: ${method}` } };
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET: return server info (for Glama health check)
  if (req.method === "GET") {
    return res.status(200).json({
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      status: "healthy",
      transport: "streamable-http",
      tools: TOOLS.length,
      endpoints: {
        verify: "/api/trust?action=verify",
        translate: "/api/trust?action=translate",
        formats: "/api/trust?action=formats",
        pipeline: "/api/trust?action=pipeline",
        ocsp: "/api/ocsp?card_id=… | ?kid=…",
        crl: "/api/crl"
      }
    });
  }

  // POST: handle JSON-RPC
  if (req.method === "POST") {
    try {
      const body = req.body;
      
      // Handle batch requests
      if (Array.isArray(body)) {
        const results = [];
        for (const req of body) {
          const result = await handleRequest(req.method, req.params, req.id);
          if (result !== null) {
            results.push({ jsonrpc: "2.0", result, id: req.id });
          }
        }
        return res.status(200).json(results);
      }

      // Single request
      const result = await handleRequest(body.method, body.params, body.id);
      
      // Notification (no id) — no response
      if (body.id === undefined || body.id === null) {
        return res.status(202).end();
      }

      return res.status(200).json({
        jsonrpc: "2.0",
        result,
        id: body.id
      });
    } catch (error) {
      return res.status(200).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message },
        id: req.body?.id || null
      });
    }
  }

  // DELETE: close session
  if (req.method === "DELETE") {
    return res.status(200).json({ status: "closed" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// /api/mcp.js — MCP Server HTTP endpoint for Glama
// Wraps the MarketNow MCP server (stdio) as Streamable HTTP
// 
// This endpoint:
// 1. Accepts POST requests with JSON-RPC 2.0 MCP protocol
// 2. Responds to initialize, tools/list, tools/call
// 3. Returns the server's capabilities and tools

const TRUST_API = "https://www.marketnow.site/api/trust";

// MCP Server info
const SERVER_INFO = {
  name: "marketnow-mcp",
  version: "1.10.1",
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
    description: "Search the MarketNow MCP marketplace for skills (9,248+ MCP servers).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category: { type: "string", description: "Filter by category" }
      }
    }
  }
];

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
          const resp = await fetch(`https://www.marketnow.site/api/skills.json?q=${encodeURIComponent(args.query || "")}`);
          const data = await resp.json();
          const skills = Array.isArray(data) ? data.slice(0, 10) : (data.skills || []).slice(0, 10);
          return {
            content: [{ type: "text", text: JSON.stringify(skills, null, 2) }]
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
        pipeline: "/api/trust?action=pipeline"
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
        id: body?.id || null
      });
    }
  }

  // DELETE: close session
  if (req.method === "DELETE") {
    return res.status(200).json({ status: "closed" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

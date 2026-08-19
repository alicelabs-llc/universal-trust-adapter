// MarketNow — MCP HTTP Endpoint
// ================================
// Provides MCP protocol over HTTP (SSE + JSON-RPC)
// This fixes the 404 reported by FLUJO and other MCP clients that
// try to connect via HTTP transport instead of stdio.
//
// Supports:
//   GET  /api/mcp      → SSE stream (Server-Sent Events)
//   POST /api/mcp      → JSON-RPC 2.0 request/response
//
// Tools exposed:
//   - search_skills
//   - get_skill
//   - list_categories
//   - health

const BASE_URL = "https://marketnow.site";
const SKILLS_API = `${BASE_URL}/api/skills.json`;
const CATEGORIES_API = `${BASE_URL}/categories.json`;

// Cache skills in memory (5 min TTL)
let skillsCache = null;
let categoriesCache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getSkills() {
  const now = Date.now();
  if (skillsCache && now - cacheTime < CACHE_TTL) return skillsCache;
  try {
    const res = await fetch(SKILLS_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    skillsCache = await res.json();
    cacheTime = now;
    return skillsCache;
  } catch (e) {
    return [];
  }
}

async function getCategories() {
  try {
    const res = await fetch(CATEGORIES_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

// MCP Protocol Handlers
async function handleInitialize(params) {
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      resources: {},
    },
    serverInfo: {
      name: "marketnow",
      version: "1.4.0",
    },
  };
}

async function handleToolsList() {
  return {
    tools: [
      {
        name: "search_skills",
        description: "Search the MarketNow marketplace for MCP skills by keyword, category, or max price. Returns matching skills with prices, sentinel scores, and install commands.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term (e.g. 'email automation', 'SQL analyzer')" },
            category: { type: "string", description: "Filter by category slug" },
            max_price: { type: "number", description: "Maximum price in USD" },
            limit: { type: "number", description: "Max results (default 10)", default: 10 },
          },
        },
      },
      {
        name: "get_skill",
        description: "Get full details of a specific skill by ID or slug, including install command, sentinel score, and system prompt.",
        inputSchema: {
          type: "object",
          properties: {
            skill_id: { type: "string", description: "Skill ID (e.g. mn-gen-00015) or slug" },
          },
          required: ["skill_id"],
        },
      },
      {
        name: "list_categories",
        description: "List all skill categories with counts.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "health",
        description: "Check marketplace API connectivity and stats.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
}

async function handleToolsCall(params) {
  const { name, arguments: args } = params;

  switch (name) {
    case "search_skills": {
      const skills = await getSkills();
      let results = skills;

      if (args?.query) {
        const q = args.query.toLowerCase();
        results = results.filter(s =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q) ||
          (s.tags || []).some(t => t.toLowerCase().includes(q))
        );
      }

      if (args?.category) {
        results = results.filter(s =>
          (s.category || "").toLowerCase().replace(/[^a-z0-9]+/g, "-") === args.category
        );
      }

      if (args?.max_price !== undefined) {
        results = results.filter(s => (s.price || 0) <= args.max_price);
      }

      const limit = args?.limit || 10;
      results = results.slice(0, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              results.map(s => ({
                id: s.id,
                name: s.name,
                description: (s.description || "").slice(0, 200),
                price: s.price,
                currency: s.currency || "USD",
                sentinel_score: s.sentinel_score,
                risk_level: s.risk_level,
                install: s.install,
                category: s.category,
              })),
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_skill": {
      const skills = await getSkills();
      const skill = skills.find(
        s => s.id === args.skill_id || s.slug === args.skill_id
      );

      if (!skill) {
        return {
          content: [{ type: "text", text: `Skill not found: ${args.skill_id}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: skill.id,
                name: skill.name,
                description: skill.description,
                price: skill.price,
                currency: skill.currency || "USD",
                sentinel_score: skill.sentinel_score,
                risk_level: skill.risk_level,
                review_status: skill.review_status,
                install: skill.install,
                category: skill.category,
                tags: skill.tags,
                author: skill.author,
                version: skill.version,
                license: skill.license,
                system_prompt: skill.doc?.system_prompt?.slice(0, 1000),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "list_categories": {
      const categories = await getCategories();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(categories, null, 2),
          },
        ],
      };
    }

    case "health": {
      const skills = await getSkills();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "ok",
                total_skills: skills.length,
                version: "1.4.0",
                sentinel_version: "L2.5",
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// JSON-RPC handler
async function handleJsonRpc(req, res) {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== "2.0") {
    res.status(400).json({
      jsonrpc: "2.0",
      id: id || null,
      error: { code: -32600, message: "Invalid Request — not JSON-RPC 2.0" },
    });
    return;
  }

  try {
    let result;

    switch (method) {
      case "initialize":
        result = await handleInitialize(params);
        break;
      case "notifications/initialized":
        // Notification — no response needed
        res.status(202).end();
        return;
      case "tools/list":
        result = await handleToolsList();
        break;
      case "tools/call":
        result = await handleToolsCall(params);
        break;
      case "ping":
        result = {};
        break;
      default:
        res.status(200).json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
        return;
    }

    res.status(200).json({
      jsonrpc: "2.0",
      id,
      result,
    });
  } catch (error) {
    res.status(200).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: error.message },
    });
  }
}

// SSE handler
function handleSSE(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: "connected", server: "marketnow", version: "1.4.0" })}\n\n`);

  // Keep alive
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "ping", timestamp: Date.now() })}\n\n`);
  }, 30000);

  req.on("close", () => {
    clearInterval(interval);
  });
}

// Main handler
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // GET → SSE stream
  if (req.method === "GET") {
    handleSSE(req, res);
    return;
  }

  // POST → JSON-RPC
  if (req.method === "POST") {
    await handleJsonRpc(req, res);
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

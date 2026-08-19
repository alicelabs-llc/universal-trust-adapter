#!/usr/bin/env node
/**
 * MarketNow MCP Server
 * Allows AI agents to search, browse, and install skills from marketnow.site
 *
 * Usage in mcp_config.json:
 * {
 *   "mcpServers": {
 *     "marketnow": {
 *       "command": "npx",
 *       "args": ["-y", "@marketnow/mcp-server"]
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = "https://marketnow.site";
const SKILLS_API = `${BASE_URL}/api/skills.json`;
const CATEGORIES_API = `${BASE_URL}/api/categories.json`;

// Cache skills in memory
let skillsCache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSkills() {
  const now = Date.now();
  if (skillsCache && now - cacheTime < CACHE_TTL) return skillsCache;
  const res = await fetch(SKILLS_API);
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.status}`);
  skillsCache = await res.json();
  cacheTime = now;
  return skillsCache;
}

async function getCategories() {
  const res = await fetch(CATEGORIES_API);
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return await res.json();
}

const server = new Server(
  {
    name: "marketnow",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ── LIST TOOLS ──────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_skills",
      description:
        "Search the MarketNow marketplace for MCP skills by keyword, category, or provider. Returns matching skills with prices, ratings, and install configs.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term (e.g. 'email automation', 'SQL analyzer', 'blockchain')",
          },
          category: {
            type: "string",
            description:
              "Filter by category (e.g. 'DevOps', 'Security', 'Sales', 'Healthcare', 'Education')",
          },
          max_price: {
            type: "number",
            description: "Maximum price in USD (0 for free skills only)",
          },
          min_trust_score: {
            type: "number",
            description: "Minimum trust score 0-100 (e.g. 90 for highly trusted skills only)",
          },
          limit: {
            type: "number",
            description: "Max results to return (default: 10, max: 50)",
          },
        },
        required: [],
      },
    },
    {
      name: "get_skill",
      description:
        "Get full details of a specific skill by ID, including MCP config, benchmarks, setup instructions, and usage examples.",
      inputSchema: {
        type: "object",
        properties: {
          skill_id: {
            type: "string",
            description: "The skill ID (e.g. 'mn-dev-00001')",
          },
        },
        required: ["skill_id"],
      },
    },
    {
      name: "list_categories",
      description: "List all available skill categories in the MarketNow marketplace.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "get_top_skills",
      description:
        "Get top-rated or most popular skills. Useful for discovering best-in-class capabilities.",
      inputSchema: {
        type: "object",
        properties: {
          sort_by: {
            type: "string",
            enum: ["rating", "executions", "trust_score", "roi"],
            description: "Sort criteria (default: rating)",
          },
          category: {
            type: "string",
            description: "Optional category filter",
          },
          limit: {
            type: "number",
            description: "Number of results (default: 10)",
          },
        },
        required: [],
      },
    },
    {
      name: "get_free_skills",
      description: "Get all free skills available in the MarketNow marketplace.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Optional category filter",
          },
        },
        required: [],
      },
    },
    {
      name: "get_install_config",
      description:
        "Get the MCP install configuration for a skill — ready to paste into your mcp_config.json or claude_desktop_config.json.",
      inputSchema: {
        type: "object",
        properties: {
          skill_id: {
            type: "string",
            description: "The skill ID to get the install config for",
          },
        },
        required: ["skill_id"],
      },
    },
  ],
}));

// ── CALL TOOLS ──────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_skills": {
        const skills = await getSkills();
        let results = skills;

        if (args.query) {
          const q = args.query.toLowerCase();
          results = results.filter(
            (s) =>
              s.name?.toLowerCase().includes(q) ||
              s.description?.toLowerCase().includes(q) ||
              s.tagline?.toLowerCase().includes(q) ||
              s.tags?.some((t) => t.toLowerCase().includes(q)) ||
              s.provider?.toLowerCase().includes(q)
          );
        }

        if (args.category) {
          const cat = args.category.toLowerCase();
          results = results.filter((s) => s.category?.toLowerCase() === cat);
        }

        if (typeof args.max_price === "number") {
          results = results.filter((s) => s.price <= args.max_price);
        }

        if (typeof args.min_trust_score === "number") {
          results = results.filter((s) => s.trustScore >= args.min_trust_score);
        }

        const limit = Math.min(args.limit || 10, 50);
        results = results.slice(0, limit);

        const summary = results.map((s) => ({
          id: s.id,
          name: s.name,
          tagline: s.tagline,
          category: s.category,
          provider: s.provider,
          price: s.price === 0 ? "FREE" : `$${s.price}/mo`,
          rating: s.rating,
          trustScore: s.trustScore,
          verified: s.verified,
          executions: s.executions,
          roi: s.roi,
          latency: s.latency,
        }));

        return {
          content: [
            {
              type: "text",
              text:
                results.length === 0
                  ? "No skills found matching your criteria."
                  : `Found ${results.length} skill(s):\n\n${JSON.stringify(summary, null, 2)}\n\nUse get_skill(id) for full details and install config.`,
            },
          ],
        };
      }

      case "get_skill": {
        const skills = await getSkills();
        const skill = skills.find((s) => s.id === args.skill_id);

        if (!skill) {
          return {
            content: [
              {
                type: "text",
                text: `Skill '${args.skill_id}' not found. Use search_skills to find valid IDs.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(skill, null, 2),
            },
          ],
        };
      }

      case "list_categories": {
        const skills = await getSkills();
        const cats = {};
        for (const s of skills) {
          cats[s.category] = (cats[s.category] || 0) + 1;
        }
        const sorted = Object.entries(cats)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ category: name, skills: count }));

        return {
          content: [
            {
              type: "text",
              text: `MarketNow Categories (${sorted.length} total):\n\n${JSON.stringify(sorted, null, 2)}`,
            },
          ],
        };
      }

      case "get_top_skills": {
        const skills = await getSkills();
        let results = skills;

        if (args.category) {
          const cat = args.category.toLowerCase();
          results = results.filter((s) => s.category?.toLowerCase() === cat);
        }

        const sortBy = args.sort_by || "rating";
        const sortMap = {
          rating: (a, b) => b.rating - a.rating,
          trust_score: (a, b) => b.trustScore - a.trustScore,
          executions: (a, b) =>
            parseFloat(b.executions) - parseFloat(a.executions),
          roi: (a, b) =>
            parseFloat(b.roi) - parseFloat(a.roi),
        };

        results = results.sort(sortMap[sortBy] || sortMap.rating);
        const limit = Math.min(args.limit || 10, 50);
        results = results.slice(0, limit);

        const summary = results.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          provider: s.provider,
          price: s.price === 0 ? "FREE" : `$${s.price}/mo`,
          rating: s.rating,
          trustScore: s.trustScore,
          roi: s.roi,
          executions: s.executions,
        }));

        return {
          content: [
            {
              type: "text",
              text: `Top ${results.length} skills by ${sortBy}:\n\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        };
      }

      case "get_free_skills": {
        const skills = await getSkills();
        let results = skills.filter((s) => s.price === 0);

        if (args.category) {
          const cat = args.category.toLowerCase();
          results = results.filter((s) => s.category?.toLowerCase() === cat);
        }

        const summary = results.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          provider: s.provider,
          rating: s.rating,
          trustScore: s.trustScore,
          executions: s.executions,
        }));

        return {
          content: [
            {
              type: "text",
              text: `${results.length} free skill(s) available:\n\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        };
      }

      case "get_install_config": {
        const skills = await getSkills();
        const skill = skills.find((s) => s.id === args.skill_id);

        if (!skill) {
          return {
            content: [
              {
                type: "text",
                text: `Skill '${args.skill_id}' not found.`,
              },
            ],
          };
        }

        const config = skill.doc?.mcpConfig || {
          mcpServers: {
            [skill.id]: {
              command: "npx",
              args: ["-y", `@marketnow-registry/${skill.id}`],
              env: { [`${skill.id.toUpperCase().replace(/-/g, "_")}_API_KEY`]: "YOUR_KEY_HERE" },
              transport: "stdio",
            },
          },
        };

        return {
          content: [
            {
              type: "text",
              text: `# Install Config for: ${skill.name}\n\nPaste this into your mcp_config.json or claude_desktop_config.json:\n\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\nSetup instructions:\n${skill.doc?.setup || "See marketnow.site for details."}\n\nUsage example:\n${skill.doc?.usage || ""}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ── LIST RESOURCES ───────────────────────────────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "marketnow://marketplace",
      name: "MarketNow Marketplace",
      description: "The full MarketNow MCP skills marketplace",
      mimeType: "text/plain",
    },
    {
      uri: "marketnow://api-reference",
      name: "API Reference",
      description: "MarketNow REST API reference",
      mimeType: "text/plain",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "marketnow://marketplace") {
    const skills = await getSkills();
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `MarketNow Marketplace — ${skills.length} skills available\n\nBase URL: ${BASE_URL}\nSkills API: ${SKILLS_API}\nCategories API: ${CATEGORIES_API}\n\nUse the search_skills, get_top_skills, or get_free_skills tools to browse.`,
        },
      ],
    };
  }

  if (uri === "marketnow://api-reference") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `MarketNow REST API\n\nGET ${BASE_URL}/api/skills.json — Full skills catalog (JSON array)\nGET ${BASE_URL}/api/categories.json — Available categories\nGET ${BASE_URL}/.well-known/agent.json — Agent discovery card\nGET ${BASE_URL}/sitemap.xml — Sitemap\n\nAll endpoints are public, CORS-enabled, no auth required for browsing.`,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ── START ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MarketNow MCP Server running — connect via stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

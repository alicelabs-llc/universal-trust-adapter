/**
 * MarketNow — AI Skill Matching
 *
 * Permite a un agente o humano describir qué necesita,
 * y recomienda skills relevantes del catálogo.
 *
 * Usa un algoritmo simple de scoring basado en:
 *  - Coincidencia de keywords en name, description, tags
 *  - Boost por popularidad (sentinel_score)
 *  - Penalty por precio alto (preferimos skills accesibles)
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'i', 'me',
  'my', 'we', 'us', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'them', 'their', 'this', 'that', 'these', 'those', 'and', 'or', 'but',
  'not', 'no', 'so', 'if', 'then', 'than', 'too', 'very', 'just', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'once',
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
  'y', 'o', 'pero', 'que', 'en', 'para', 'por', 'con', 'sin', 'sobre',
  'necesito', 'quiero', 'buscar', 'encontrar',
]);

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Score a skill against a query.
 * Returns a number; higher = more relevant.
 */
function scoreSkill(skill, queryTokens) {
  if (queryTokens.length === 0) return 0;

  const nameTokens = tokenize(skill.name);
  const descTokens = tokenize(skill.description);
  const tagTokens = (skill.tags || []).flatMap(t => tokenize(t));

  let score = 0;
  for (const q of queryTokens) {
    // Name match is strongest (10 pts)
    if (nameTokens.includes(q)) score += 10;
    // Tag match (8 pts)
    if (tagTokens.includes(q)) score += 8;
    // Description match (3 pts)
    if (descTokens.includes(q)) score += 3;
    // Partial match in any field (1 pt)
    if (skill.name?.toLowerCase().includes(q)) score += 1;
    if (skill.description?.toLowerCase().includes(q)) score += 1;
  }

  // Boost: prefer higher sentinel score (more trustworthy)
  score += (skill.sentinel_score || 6) * 0.5;

  // Penalty: prefer cheaper skills (accessibility for agents)
  if (skill.price > 5) score -= 1;
  if (skill.price > 9) score -= 1;

  // Normalize by query length
  return score / Math.sqrt(queryTokens.length);
}

/**
 * Find the best skills for a natural-language query.
 * @param {Array} skills - all skills from /api/skills.json
 * @param {string} query - natural language description
 * @param {number} limit - max results
 * @returns {Array} - top matching skills with score
 */
export function matchSkills(skills, query, limit = 5) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = skills
    .map(s => ({ skill: s, score: scoreSkill(s, queryTokens) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/**
 * Generate a natural-language recommendation message.
 */
export function generateRecommendation(query, matches) {
  if (matches.length === 0) {
    return `I couldn't find any skills matching "${query}". Try different keywords or browse the full registry at /registry.`;
  }

  const top = matches[0];
  let msg = `Based on "${query}", I found ${matches.length} skill${matches.length === 1 ? '' : 's'} that match your needs.\n\n`;
  msg += `Top recommendation: ${top.skill.name} ($${top.skill.price.toFixed(2)}) — ${top.skill.description?.slice(0, 100) || 'MCP server'}\n\n`;
  if (matches.length > 1) {
    msg += `Other options:\n`;
    matches.slice(1).forEach((m, i) => {
      msg += `${i + 2}. ${m.skill.name} ($${m.skill.price.toFixed(2)}) — ${m.skill.description?.slice(0, 80) || ''}\n`;
    });
  }
  return msg;
}

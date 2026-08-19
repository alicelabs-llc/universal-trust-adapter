import { API_BASE } from '../api/client';

let skillsCache = null;
let freeSkillsCache = null;

export async function getAllSkills() {
  if (skillsCache) return skillsCache;
  try {
    // Use skills_index.json — has full data (doc, capabilities, sentinel)
    const res = await fetch(`${API_BASE}/api/skills_index.json`);
    if (res.ok) { skillsCache = await res.json(); return skillsCache; }
  } catch {}
  // Fallback to skills-lite.json (less data but smaller)
  try {
    const res = await fetch(`${API_BASE}/api/skills-lite.json`);
    if (res.ok) { skillsCache = await res.json(); return skillsCache; }
  } catch {}
  return [];
}

export async function getFreeSkills() {
  if (freeSkillsCache) return freeSkillsCache;
  try {
    const res = await fetch(`${API_BASE}/api/free-skills.json`);
    if (res.ok) {
      const data = await res.json();
      freeSkillsCache = data.skills || data;
      return freeSkillsCache;
    }
  } catch {}
  return [];
}

export async function getSkill(id) {
  // 1. Load from skills_index.json (has full data: doc, capabilities, sentinel)
  const skills = await getAllSkills();
  let skill = skills.find(s => s.id === id || s.slug === id) || null;

  // 2. Cross-reference with free-skills.json to get the free flag
  if (skill) {
    const freeSkills = await getFreeSkills();
    const freeSkill = freeSkills.find(s => s.id === skill.id);
    if (freeSkill) {
      // Override: mark as free with price=0
      skill = { ...skill, ...freeSkill, price: 0, free: true };
    }
  }

  return skill;
}

export async function getSkillsByCategory(category) {
  const skills = await getAllSkills();
  if (!category || category === 'All') return skills;
  return skills.filter(s => s.category === category);
}

export async function searchSkills(query, cat = '', lang = '', limit = 20, offset = 0) {
  const params = new URLSearchParams();
  if (query)  params.set('q', query);
  if (cat)    params.set('cat', cat);
  if (lang)   params.set('lang', lang);
  params.set('limit', '' + limit);
  params.set('offset', '' + offset);
  try {
    const res = await fetch(`${API_BASE}/api/search?` + params.toString());
    if (res.ok) return await res.json();
  } catch {}
  return { total: 0, results: [] };
}

export async function getCategories() {
  try {
    const res = await fetch(`${API_BASE}/api/categories.json`);
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

export default skillsCache;

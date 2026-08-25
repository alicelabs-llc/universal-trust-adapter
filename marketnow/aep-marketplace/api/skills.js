// Paginated skills API — replaces the 24MB skills.json blob
// Usage: GET /api/skills?page=1&limit=100
//       GET /api/skills?page=1&limit=100&category=ai-ml
//       GET /api/skills?page=1&limit=100&filter=free

import skillsData from '../public/api/skills-lite.json' with { type: 'json' };

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));
  const category = req.query.category;
  const filter = req.query.filter;
  
  let skills = skillsData.skills || skillsData || [];
  
  // Filter by category
  if (category) {
    skills = skills.filter(s => s.category === category);
  }
  
  // Filter by free
  if (filter === 'free') {
    skills = skills.filter(s => s.is_free === true || s.price === 0);
  }
  
  const total = skills.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const pageSkills = skills.slice(offset, offset + limit);
  
  res.status(200).json({
    page,
    limit,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
    skills: pageSkills,
    _links: {
      self: `/api/skills?page=${page}&limit=${limit}${category ? '&category=' + category : ''}${filter ? '&filter=' + filter : ''}`,
      next: page < totalPages ? `/api/skills?page=${page + 1}&limit=${limit}${category ? '&category=' + category : ''}${filter ? '&filter=' + filter : ''}` : null,
      prev: page > 1 ? `/api/skills?page=${page - 1}&limit=${limit}${category ? '&category=' + category : ''}${filter ? '&filter=' + filter : ''}` : null,
    }
  });
}

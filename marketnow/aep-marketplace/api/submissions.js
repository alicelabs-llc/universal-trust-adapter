// GET /api/submissions — public submission queue (auditable)
// GET /api/submissions?id=mn-sub-xxxxxx → single submission record
// Reads from the public repo alicelabs-llc/marketnow-submissions.

import { listSubmissions } from '../lib/submit-core.mjs';

const GH_API = 'https://api.github.com';
const GH_RAW = 'https://raw.githubusercontent.com/alicelabs-llc/marketnow-submissions/main';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');

  const id = (req.query.id || '').trim();
  if (id) {
    if (!/^mn-sub-[a-z0-9-]+$/i.test(id)) {
      return res.status(400).json({ ok: false, error: 'invalid submission id format' });
    }
    // buscar el path en el árbol y leer el registro
    try {
      const token = process.env.MN_SUBMIT_TOKEN;
      const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'marketnow-submit' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const tree = await fetch(`${GH_API}/repos/alicelabs-llc/marketnow-submissions/git/trees/main?recursive=1`,
        { headers, signal: AbortSignal.timeout(15000) });
      if (!tree.ok) throw new Error(`tree ${tree.status}`);
      const j = await tree.json();
      const node = (j.tree || []).find(t => t.path.endsWith(`/${id}.json`));
      if (!node) return res.status(404).json({ ok: false, error: 'submission not found' });
      const raw = await fetch(`${GH_RAW}/${node.path}`, { signal: AbortSignal.timeout(10000) });
      if (!raw.ok) throw new Error(`raw ${raw.status}`);
      const rec = await raw.json();
      return res.status(200).json({ ok: true, submission: rec });
    } catch (e) {
      return res.status(502).json({ ok: false, error: `queue read failed: ${String(e && e.message || e).slice(0, 120)}` });
    }
  }

  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
  try {
    const q = await listSubmissions(limit);
    if (!q.ok) return res.status(502).json({ ok: false, error: `queue read failed: ${q.reason}` });
    return res.status(200).json({
      ok: true,
      total_submissions: q.total,
      showing: q.items.length,
      items: q.items,
      audit_trail: q.note,
      submit_docs: 'GET /api/submit',
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `queue read failed: ${String(e && e.message || e).slice(0, 120)}` });
  }
}

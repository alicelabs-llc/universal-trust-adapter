import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { isAuthenticated, getUser } from '../api/client';

/**
 * MarketNow — Skill Reviews
 *
 * Sistema de reviews client-side usando localStorage.
 * Cada review tiene: user, rating (1-5), text, timestamp.
 * Las reviews se muestran en la página de detalle de skill.
 *
 * NOTA: Para producción real, migrar a backend con moderación.
 * Por ahora, esto permite funcionalidad básica en GitHub Pages.
 */

const STORAGE_KEY = 'mn_reviews';

function loadAllReviews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllReviews(reviews) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

export function getReviews(skillId) {
  const all = loadAllReviews();
  return all[skillId] || [];
}

export function addReview(skillId, review) {
  const all = loadAllReviews();
  if (!all[skillId]) all[skillId] = [];
  all[skillId].push({
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user: review.user,
    rating: review.rating,
    text: review.text,
    timestamp: new Date().toISOString(),
  });
  saveAllReviews(all);
  return all[skillId];
}

export function getAverageRating(skillId) {
  const reviews = getReviews(skillId);
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: sum / reviews.length,
    count: reviews.length,
  };
}

export default function Reviews({ skillId }) {
  const [reviews, setReviews] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 5, text: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    setReviews(getReviews(skillId));
  }, [skillId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated()) {
      setError('Sign in to leave a review');
      return;
    }

    if (form.text.trim().length < 10) {
      setError('Review must be at least 10 characters');
      return;
    }

    const user = getUser();
    const updated = addReview(skillId, {
      user: user?.username || 'anonymous',
      rating: form.rating,
      text: form.text.trim(),
    });
    setReviews(updated);
    setForm({ rating: 5, text: '' });
    setShowForm(false);
  };

  const avg = reviews.length > 0
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="mt-6 premium-card p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold">
          REVIEWS {avg && <span className="text-[#00F299] ml-2">★ {avg} ({reviews.length})</span>}
        </h3>
        {isAuthenticated() && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#00F299]/10 border border-[#00F299]/30 rounded-lg text-xs text-[#00F299] font-mono hover:bg-[#00F299]/20 transition-all"
          >
            + WRITE REVIEW
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
        >
          <div>
            <label className="text-zinc-400 text-xs block mb-2">RATING</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, rating: n })}
                  className={`text-2xl transition-all ${n <= form.rating ? 'text-[#00F299]' : 'text-zinc-700'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-2">YOUR REVIEW</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              rows={3}
              placeholder="Share your experience with this skill..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:border-[#00F299]/50 focus:outline-none resize-none"
              maxLength={500}
            />
            <div className="text-[10px] text-zinc-500 mt-1">{form.text.length}/500</div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[#00F299] text-black text-xs font-bold rounded-lg hover:bg-[#00F299]/90 transition-all"
            >
              SUBMIT REVIEW
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-white/10 text-zinc-400 text-xs rounded-lg hover:bg-white/5 transition-all"
            >
              CANCEL
            </button>
          </div>
        </motion.form>
      )}

      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-zinc-500 text-sm">No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="p-4 rounded-xl bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-mono">{r.user}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#00F299] text-xs">
                    {'★'.repeat(r.rating)}<span className="text-zinc-700">{'★'.repeat(5 - r.rating)}</span>
                  </span>
                  <span className="text-zinc-600 text-[10px] font-mono">
                    {new Date(r.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-zinc-400 text-sm">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

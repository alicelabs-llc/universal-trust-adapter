import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { setAuth } from '../api/client';

/**
 * MarketNow — Auth Modal (secure client-side version)
 *
 * SECURITY MEASURES:
 * 1. Email validation (RFC-compliant regex)
 * 2. Password strength requirements (8+ chars, uppercase, lowercase, number)
 * 3. Password hashing with Web Crypto API (SHA-256 + salt)
 * 4. NEVER store plaintext passwords
 * 5. Rate limiting (max 5 attempts per 15 min, then 15 min lockout)
 * 6. Username sanitization (no HTML, no special chars)
 * 7. Account lockout after 5 failed login attempts
 *
 * LIMITATIONS (honest):
 * - Client-side auth is inherently less secure than server-side
 * - For production with real money, we recommend the /api/mandates flow
 *   with wallet-based auth (sign message with your wallet to prove ownership)
 * - This auth is for convenience (vault, dashboard) — NOT for spending
 */

// Email validation (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Password: 8+ chars, 1 uppercase, 1 lowercase, 1 number
function validatePassword(pwd) {
  if (pwd.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pwd)) return 'Password must contain at least 1 uppercase letter';
  if (!/[a-z]/.test(pwd)) return 'Password must contain at least 1 lowercase letter';
  if (!/[0-9]/.test(pwd)) return 'Password must contain at least 1 number';
  return null;
}

function validateEmail(email) {
  if (!email) return 'Email is required';
  if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email address';
  if (email.length > 254) return 'Email is too long';
  return null;
}

function sanitizeUsername(username) {
  // Remove any HTML-like chars, limit to alphanumeric + underscore + hyphen
  return username.replace(/[<>"'&]/g, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
}

// Web Crypto API: SHA-256 with salt
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password + 'marketnow_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limiting
const RATE_LIMIT_KEY = 'mn_auth_rate';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getRateLimit() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function setRateLimit(rl) {
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rl));
}

function isLocked() {
  const rl = getRateLimit();
  if (rl.lockedUntil > Date.now()) return true;
  if (rl.lockedUntil <= Date.now() && rl.attempts >= MAX_ATTEMPTS) {
    // Reset after lockout expires
    setRateLimit({ attempts: 0, lockedUntil: 0 });
  }
  return false;
}

function recordFailedAttempt() {
  const rl = getRateLimit();
  rl.attempts += 1;
  if (rl.attempts >= MAX_ATTEMPTS) {
    rl.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  setRateLimit(rl);
  return rl;
}

function resetRateLimit() {
  setRateLimit({ attempts: 0, lockedUntil: 0 });
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const validate = () => {
    const errs = {};
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
    const pwdErr = validatePassword(form.password);
    if (pwdErr) errs.password = pwdErr;
    if (mode === 'register') {
      if (!form.username || form.username.length < 3) {
        errs.username = 'Username must be at least 3 characters';
      }
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setErrors({});

    // Check rate limit
    if (isLocked()) {
      const rl = getRateLimit();
      const minsLeft = Math.ceil((rl.lockedUntil - Date.now()) / 60000);
      setGlobalError(`Too many attempts. Try again in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}.`);
      return;
    }

    // Validate
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);

    try {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 600));

      const usersRaw = localStorage.getItem('mn_users');
      const users = usersRaw ? JSON.parse(usersRaw) : [];

      if (mode === 'register') {
        // Check if email already exists
        if (users.find(u => u.email.toLowerCase() === form.email.toLowerCase())) {
          throw new Error('An account with this email already exists');
        }

        // Hash password with salt
        const salt = generateSalt();
        const hashedPassword = await hashPassword(form.password, salt);

        const newUser = {
          id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          username: sanitizeUsername(form.username),
          email: form.email.toLowerCase(),
          passwordHash: hashedPassword,
          salt: salt,
          createdAt: new Date().toISOString(),
          authVersion: 1, // for future migration
        };
        users.push(newUser);
        localStorage.setItem('mn_users', JSON.stringify(users));
        const token = `mn_token_${Date.now()}_${generateSalt()}`;
        setAuth(token, { id: newUser.id, username: newUser.username, email: newUser.email });
        resetRateLimit();
        onAuthSuccess({ id: newUser.id, username: newUser.username, email: newUser.email });
      } else {
        // login
        const user = users.find(u => u.email.toLowerCase() === form.email.toLowerCase());
        if (!user) {
          const rl = recordFailedAttempt();
          const remaining = MAX_ATTEMPTS - rl.attempts;
          throw new Error(remaining > 0
            ? `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Too many failed attempts. Account locked for 15 minutes.');
        }

        // Verify password hash
        const hashedInput = await hashPassword(form.password, user.salt);
        if (hashedInput !== user.passwordHash) {
          const rl = recordFailedAttempt();
          const remaining = MAX_ATTEMPTS - rl.attempts;
          throw new Error(remaining > 0
            ? `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Too many failed attempts. Account locked for 15 minutes.');
        }

        const token = `mn_token_${Date.now()}_${generateSalt()}`;
        setAuth(token, { id: user.id, username: user.username, email: user.email });
        resetRateLimit();
        onAuthSuccess({ id: user.id, username: user.username, email: user.email });
      }

      onClose();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const locked = isLocked();
  const lockMinsLeft = locked ? Math.ceil((getRateLimit().lockedUntil - Date.now()) / 60000) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="premium-card w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </h2>
                <p className="text-zinc-500 text-xs mt-1">
                  🔒 Passwords hashed with SHA-256 + salt. Never stored in plaintext.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            {globalError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {globalError}
              </div>
            )}

            {locked && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                🔒 Account locked. Try again in {lockMinsLeft} minute{lockMinsLeft === 1 ? '' : 's'}.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="text-zinc-400 text-sm block mb-1.5">Username</label>
                  <input
                    type="text"
                    placeholder="your_username"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none transition-all ${
                      errors.username ? 'border-red-500/50' : 'border-white/10 focus:border-[#00F299]/50'
                    }`}
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                  />
                  {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
                </div>
              )}

              <div>
                <label className="text-zinc-400 text-sm block mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none transition-all ${
                    errors.email ? 'border-red-500/50' : 'border-white/10 focus:border-[#00F299]/50'
                  }`}
                  required
                  autoComplete="email"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="text-zinc-400 text-sm block mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none transition-all ${
                    errors.password ? 'border-red-500/50' : 'border-white/10 focus:border-[#00F299]/50'
                  }`}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                {mode === 'register' && !errors.password && (
                  <p className="text-zinc-600 text-[10px] mt-1">
                    Min 8 chars, 1 uppercase, 1 lowercase, 1 number
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || locked}
                className="w-full py-3.5 bg-[#00F299] text-black font-semibold rounded-xl hover:bg-[#00F299]/90 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
              >
                {loading ? 'Processing...' : locked ? 'LOCKED' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}); setGlobalError(''); }}
                className="text-zinc-500 hover:text-[#00F299] text-sm transition-colors"
              >
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/5">
              <p className="text-zinc-600 text-[10px] leading-relaxed">
                <strong className="text-zinc-500">Security note:</strong> This is client-side auth for convenience
                (vault, dashboard). For spending money, use mandates with wallet-based auth at /mandates —
                that's the secure path. Client-side auth is inherently less secure than server-side.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// API Client for AEP Marketplace
// Uses the correct API base based on environment

// En producción (Cloudflare Pages), las rutas /api/* se manejan desde el mismo dominio
// En desarrollo local, usar VITE_API_URL o fallback a localhost:3001
export const API_BASE = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && 
   !window.location.hostname.includes('marketnow.site')
     ? 'https://marketnow.site'
     : '');

async function request(endpoint, options = {}) {
  const { method = 'GET', body, auth = false } = options;

  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = localStorage.getItem('aep_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}/api${endpoint}`, config);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = errorData;
    throw error;
  }

  return res.json();
}

// Auth
export async function login(email, password) {
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

export async function register(username, email, password) {
  return request('/auth/register', { method: 'POST', body: { username, email, password } });
}

// Skills
export async function fetchSkills() {
  return request('/skills');
}

export async function fetchSkill(id) {
  return request(`/skills/${id}`);
}

// Vault
export async function fetchVault() {
  return request('/vault', { auth: true });
}

// Checkout
export async function createCheckoutSession(skillId) {
  return request('/checkout/create-session', { method: 'POST', body: { skillId }, auth: true });
}

// Governance
export async function fetchProposals() {
  return request('/governance/proposals');
}

export async function castVote(proposalId) {
  return request('/governance/vote', { method: 'POST', body: { proposalId }, auth: true });
}

// Security
export async function fetchAuditLogs() {
  return request('/security/audit-logs');
}

// Handshake
export async function connectToMesh(apiKey = '') {
  return request('/handshake/connect', { method: 'POST', body: { apiKey } });
}

// Auth helpers
export function getToken() {
  return localStorage.getItem('aep_token');
}

export function getUser() {
  const raw = localStorage.getItem('aep_user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated() {
  return !!getToken();
}

export function setAuth(token, user) {
  localStorage.setItem('aep_token', token);
  localStorage.setItem('aep_user', JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem('aep_token');
  localStorage.removeItem('aep_user');
}

// uta-pay-mcp-bridge — fail-closed spend-authority hook for the Solana Pay MCP.
//
// Composition (solana-foundation/pay#505):
//   Pay MCP  : execution + launch-time YAML (budget & authorizations)
//   Yosh     : runtime state (per-agent grants, cumulative budgets, revocation)
//   UTA      : dynamic spending authority — verifies the AGENT (ATC/1.0) and
//              re-checks revocation on every spend, fail-closed, receipts signed.
//
// Property enforced here: **no spend is ever honored because verification was
// unavailable.** Any error in the trust path denies by default.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { canonicalize, sha256Hex, makeKeyPair, signReceipt, verifyReceipt } from "./receipts.mjs";

let YAML = null;
try {
  YAML = (await import("yaml")).default;
} catch {
  YAML = null; // fallback mini-parser below
}

// ---------- tolerant YAML loading ----------

const deepGet = (o, ...ks) => ks.map((k) => (o && typeof o === "object" ? o[k] : undefined));
const pick = (o, ...ks) => {
  for (const k of ks) if (o && typeof o === "object" && o[k] !== undefined) return o[k];
  return undefined;
};

// Minimal indent-based YAML subset parser (fallback when `yaml` is absent).
// Supports: scalars, one-level nested maps, lists of scalars, lists of maps —
// the shape of examples/pay-mcp.yaml.
export function parseMiniYaml(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  let i = 0;
  // strip an inline `# comment` only when it starts outside quotes and is
  // preceded by whitespace (YAML rule: `a#b` inside a plain scalar is a value)
  const stripComment = (s) => {
    let q = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === "#" && (k === 0 || /\s/.test(s[k - 1]))) return s.slice(0, k);
    }
    return s;
  };
  const parseFlowList = (s) => {
    if (!(s.startsWith("[") && s.endsWith("]"))) return undefined;
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((x) => scalar(x.trim()));
  };
  const scalar = (s) => {
    s = stripComment(s).trim();
    if (s === "") return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null" || s === "~") return null;
    const flow = parseFlowList(s);
    if (flow !== undefined) return flow;
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
      return s.slice(1, -1);
    return s;
  };
  function parseBlock(indent) {
    const out = {};
    let list = null;
    while (i < lines.length) {
      const line = lines[i];
      const ind = line.match(/^\s*/)[0].length;
      if (ind < indent) break;
      const t = line.trim();
      if (t.startsWith("- ")) {
        if (!list) list = [];
        const rest = t.slice(2);
        const m = rest.match(/^([^:]+):\s*(.*)$/);
        if (m) {
          // list of maps: first pair inline, following lines belong to it
          const item = { [m[1].trim()]: scalar(m[2]) };
          i++;
          while (i < lines.length) {
            const l2 = lines[i];
            const ind2 = l2.match(/^\s*/)[0].length;
            const t2 = l2.trim();
            if (ind2 <= indent || t2.startsWith("- ")) break;
            const m2 = t2.match(/^([^:]+):\s*(.*)$/);
            if (m2) item[m2[1].trim()] = scalar(m2[2]);
            i++;
          }
          list.push(item);
        } else {
          list.push(scalar(rest));
          i++;
        }
        continue;
      }
      if (list) {
        out.__list = list;
        list = null;
      }
      const m = t.match(/^([^:]+):\s*(.*)$/);
      if (!m) {
        i++;
        continue;
      }
      const key = m[1].trim();
      const val = m[2];
      if (val === "") {
        i++;
        const child = parseBlock(ind + 1);
        out[key] = child.__list !== undefined ? child.__list : child;
        if (child.__list === undefined && Object.keys(child).length === 0) out[key] = null;
      } else {
        out[key] = scalar(val);
        i++;
      }
    }
    if (list) out.__list = list;
    return out;
  }
  return parseBlock(0);
}

export function parsePolicyYaml(text) {
  const doc = YAML ? YAML.parse(text) : parseMiniYaml(text);
  return normalizePolicy(doc);
}

export async function loadPolicy(policyPath) {
  return parsePolicyYaml(await readFile(policyPath, "utf8"));
}

// ---------- normalization (schema-tolerant: will mirror the official
// Pay MCP YAML 1:1 once published — tracked in the README) ----------

const BAND_RANK = { B0: 0, B1: 1, B2: 2, B3: 3, A1: 4 };

function normalizeGrant(g, i) {
  return {
    agent: String(pick(g, "agent", "agent_id", "agentId", "did") ?? `agent-${i}`),
    resources: pick(g, "resources", "allowed", "tools") ?? ["*"],
    max_usd_per_day: Number(pick(g, "max_usd_per_day", "maxUsdPerDay", "daily_cap_usd", "limit") ?? 0),
    trust_band_min: pick(g, "trust_band_min", "trustBandMin", "min_band") ?? null,
  };
}

export function normalizePolicy(doc) {
  const budget = pick(doc, "budget", "budgets") ?? {};
  const grants = (pick(doc, "authorizations", "authorizations:", "grants", "agents") ?? []).map(normalizeGrant);
  const rev = pick(doc, "revocation", "revocations") ?? {};
  const uta = pick(doc, "uta", "trust") ?? {};
  const policy = {
    budget: {
      total_usd: Number(pick(budget, "total_usd", "totalUsd") ?? 0),
      per_spend_max_usd: Number(pick(budget, "per_spend_max_usd", "perSpendMaxUsd") ?? 0),
      window: pick(budget, "window") ?? "day",
    },
    authorizations: grants,
    revocation: {
      check_url: pick(rev, "check_url", "checkUrl") ?? null,
      fail_closed: pick(rev, "fail_closed", "failClosed") ?? true,
    },
    uta: {
      verify_url: pick(uta, "verify_url", "verifyUrl") ?? "https://uta.alicelabs.site/v1/trust/verify",
    },
  };
  policy.policy_sha256 = sha256Hex(canonicalize(policy));
  return policy;
}

// ---------- the fail-closed hook ----------

function bandSufficient(band, min) {
  if (!min) return true;
  if (band === undefined || band === null) return false; // fail-closed
  const b = BAND_RANK[String(band).toUpperCase()];
  const m = BAND_RANK[String(min).toUpperCase()];
  if (b === undefined || m === undefined) return false;
  return b >= m;
}

function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function createUtaHook({
  policy,
  policyPath,
  verifyUrl,
  revocationUrl,
  fetchImpl = fetch,
  keyPair = null,
  now = () => Date.now(),
} = {}) {
  if (!policy) policy = policyPath ? await loadPolicy(policyPath) : null;
  if (!policy) throw new Error("policy or policyPath required");
  const vUrl = verifyUrl ?? policy.uta.verify_url;
  const rUrl = revocationUrl ?? policy.revocation.check_url;
  const kp = keyPair ?? makeKeyPair();
  const state = { spends: [], denied: [], daily: {} }; // runtime state (Yosh-compatible concept)

  function record(kind, op, extra) {
    const entry = { ts: now(), agent: op.agent, resource: op.resource, amount_usd: op.amountUsd, ...extra };
    (kind === "allow" ? state.spends : state.denied).push(entry);
    return entry;
  }

  function budgetCheck(op) {
    const { total_usd, per_spend_max_usd } = policy.budget;
    if (per_spend_max_usd > 0 && op.amountUsd > per_spend_max_usd)
      return `per-spend cap exceeded (${op.amountUsd} > ${per_spend_max_usd})`;
    const grant = policy.authorizations.find((g) => g.agent === op.agent);
    if (grant && grant.max_usd_per_day > 0) {
      const spentToday = state.spends
        .filter((s) => s.agent === op.agent && dayKey(s.ts) === dayKey(now()))
        .reduce((a, s) => a + s.amount_usd, 0);
      if (spentToday + op.amountUsd > grant.max_usd_per_day)
        return `daily cap exceeded for ${op.agent} (${spentToday}+${op.amountUsd} > ${grant.max_usd_per_day})`;
    }
    if (total_usd > 0) {
      const spentAll = state.spends.reduce((a, s) => a + s.amount_usd, 0);
      if (spentAll + op.amountUsd > total_usd)
        return `total budget exceeded (${spentAll}+${op.amountUsd} > ${total_usd})`;
    }
    return null;
  }

  async function utaVerify(op) {
    // one-time challenge per attempt: freshness is enforced by the verifier
    const challenge = sha256Hex(canonicalize({ agent: op.agent, resource: op.resource, nonce: now(), salt: Math.random() }));
    let res, body;
    try {
      res = await fetchImpl(vUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ atc: op.atc, challenge, resource: op.resource, amount_usd: op.amountUsd }),
      });
    } catch (e) {
      return { ok: false, reason: `fail-closed: verify unreachable (${e.message})` };
    }
    if (!res.ok) return { ok: false, reason: `fail-closed: verify HTTP ${res.status}` };
    try {
      body = await res.json();
    } catch {
      return { ok: false, reason: "fail-closed: verify response not JSON" };
    }
    const verified = body.verified ?? body.valid;
    if (verified !== true) return { ok: false, reason: `verify negative: ${body.reason ?? "unverified"}` };
    const band = body.band ?? body.uts?.trust?.band ?? null;
    const verdict_id = body.verdict_id ?? `vrg_${sha256Hex(challenge).slice(0, 16)}`;
    return { ok: true, band, verdict_id };
  }

  async function revocationCheck(agent) {
    if (!rUrl) return { ok: true };
    try {
      const res = await fetchImpl(`${rUrl}?agent=${encodeURIComponent(agent)}`);
      if (!res.ok) {
        if (policy.revocation.fail_closed) return { ok: false, reason: `fail-closed: revocation HTTP ${res.status}` };
        return { ok: true, warning: `revocation unavailable (${res.status})` };
      }
      const j = await res.json();
      if (j.revoked) return { ok: false, reason: `agent revoked (${j.reason ?? "no reason"})` };
      return { ok: true };
    } catch (e) {
      if (policy.revocation.fail_closed) return { ok: false, reason: `fail-closed: revocation unreachable (${e.message})` };
      return { ok: true, warning: `revocation unreachable (${e.message})` };
    }
  }

  async function authorize(op) {
    // 1) grant must exist for agent+resource
    const grant = policy.authorizations.find(
      (g) => g.agent === op.agent && (g.resources.includes("*") || g.resources.includes(op.resource))
    );
    if (!grant) {
      const d = record("deny", op, { reason: "no grant for agent/resource" });
      return { allow: false, reason: d.reason };
    }
    // 2) budgets (runtime state — the part a static YAML snapshot cannot carry)
    const budgetErr = budgetCheck(op);
    if (budgetErr) {
      const d = record("deny", op, { reason: budgetErr });
      return { allow: false, reason: d.reason };
    }
    // 3) UTA verify — fail-closed: unreachable/malformed => deny
    const v = await utaVerify(op);
    if (!v.ok) {
      const d = record("deny", op, { reason: v.reason });
      return { allow: false, reason: d.reason };
    }
    // 4) trust band threshold from the grant class
    if (!bandSufficient(v.band, grant.trust_band_min)) {
      const d = record("deny", op, {
        reason: `trust band ${v.band ?? "unavailable"} below required ${grant.trust_band_min}`,
        verdict_id: v.verdict_id,
      });
      return { allow: false, reason: d.reason, verdict_id: v.verdict_id };
    }
    // 5) revocation — fail-closed per policy
    const r = await revocationCheck(op.agent);
    if (!r.ok) {
      const d = record("deny", op, { reason: r.reason, verdict_id: v.verdict_id });
      return { allow: false, reason: d.reason, verdict_id: v.verdict_id };
    }
    // 6) ALLOW + signed receipt
    const receipt = signReceipt(
      {
        v: 1,
        agent: op.agent,
        resource: op.resource,
        amount_usd: op.amountUsd,
        decision: "allow",
        verdict_id: v.verdict_id,
        band: v.band,
        policy_sha256: policy.policy_sha256,
        ts: new Date(now()).toISOString(),
      },
      kp.privateKey
    );
    record("allow", op, { verdict_id: v.verdict_id, receipt_sha256: receipt.receipt_sig && sha256Hex(canonicalize(receipt)) });
    return { allow: true, verdict_id: v.verdict_id, band: v.band, receipt };
  }

  return {
    authorize,
    state: () => state,
    policy: () => policy,
    publicKey: kp.publicKey,
    verifyReceipt: (signed) => verifyReceipt(signed, kp.publicKey),
  };
}

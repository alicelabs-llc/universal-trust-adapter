import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePolicyYaml, normalizePolicy, createUtaHook } from "../src/bridge.mjs";
import { readFileSync } from "node:fs";
import { verifyReceipt, makeKeyPair, signVerdict } from "../src/receipts.mjs";

const POLICY_YAML = readFileSync(new URL("../examples/pay-mcp.yaml", import.meta.url), "utf8");

const BOT = "did:web:checkout-bot.alicelabs.site";
const CRAWLER = "did:web:research-crawler.alicelabs.site";

// Pinned verifier key for the tests — the bridge must reject verdicts signed
// by any other key while strict scope binding (RFC-ATC v3 §5.2) is active.
const VKEY = makeKeyPair();

// Builds the verifier's 200 response: verdict signed over the exact request
// scope (challenge/resource/amount_usd parsed from the request body), unless
// overridden — overrides exist to prove the seller-side binding rejects them.
function signedVerifyResponse(reqBody, {
  band = "B2", key = VKEY, unsigned = false,
  resourceOverride = null, amountOverride = null, challengeOverride = null,
  issuedAt = null, expiresIn = 300,
} = {}) {
  const req = JSON.parse(reqBody);
  const verdict = {
    v: 1,
    verdict_id: "vrg_test_001",
    band,
    challenge: challengeOverride ?? req.challenge,
    resource: resourceOverride ?? req.resource,
    amount_usd: amountOverride ?? req.amount_usd,
    issued_at: issuedAt ?? new Date().toISOString(),
    expires_in: expiresIn,
  };
  const signed = signVerdict(verdict, key.privateKey);
  return {
    ok: true,
    status: 200,
    json: async () => unsigned
      ? { verified: true, band, verdict_id: verdict.verdict_id }
      : { verified: true, band, verdict_id: verdict.verdict_id, verdict, verdict_sig: signed.verdict_sig },
  };
}

// Single fetchImpl covering both endpoints; options map 1:1 to the scenario.
function fetcher({
  band = "B2", revoked = false, revFail = false, verifyFail = false,
  verify = {},
  onVerify = null, // (init) => response — full override for replay tests
} = {}) {
  return async (url, init) => {
    if (String(url).includes("/revocation")) {
      return revFail
        ? { ok: false, status: 503, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ revoked, reason: revoked ? "compromised key" : undefined }) };
    }
    if (verifyFail) return { ok: false, status: 500, json: async () => ({}) };
    if (onVerify) return onVerify(init);
    return signedVerifyResponse(init.body, { band, ...verify });
  };
}

function policy(text = POLICY_YAML) {
  return parsePolicyYaml(text);
}

// Injects the pinned verifier key by default — tests exercise the strict path.
function hookWith(policyObj, fetchImpl, opts = {}) {
  return createUtaHook({ policy: policyObj, fetchImpl, verifierPublicKey: VKEY.publicKey, ...opts });
}

test("example YAML parses and normalizes (schema-tolerant)", () => {
  const p = policy();
  assert.equal(p.budget.total_usd, 50);
  assert.equal(p.budget.per_spend_max_usd, 5);
  assert.equal(p.authorizations.length, 2);
  assert.equal(p.authorizations[0].agent, BOT);
  assert.equal(p.authorizations[0].trust_band_min, "B1");
  assert.equal(p.revocation.fail_closed, true);
  assert.equal(p.uta.scope_binding, "strict"); // §5.2 default
  assert.match(p.policy_sha256, /^[0-9a-f]{64}$/);
  // normalization is deterministic
  assert.equal(p.policy_sha256, normalizePolicy(p).policy_sha256);
});

test("allow path: grant + budget + verified band + revocation ok => signed receipt", async () => {
  let revocationAsked = false;
  const fetchImpl = async (url, init) => {
    if (String(url).includes("/revocation")) {
      revocationAsked = true;
      return { ok: true, status: 200, json: async () => ({ revoked: false }) };
    }
    return signedVerifyResponse(init.body);
  };
  const h = await hookWith(policy(), fetchImpl);
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 3, atc: { did: BOT } });
  assert.equal(r.allow, true);
  assert.equal(r.band, "B2");
  assert.ok(r.receipt);
  assert.equal(h.verifyReceipt(r.receipt), true, "receipt verifies with hook public key");
  assert.ok(revocationAsked, "revocation consulted on every spend");
  assert.equal(h.state().spends.length, 1);
});

test("deny: band below grant threshold", async () => {
  const h = await hookWith(policy(), fetcher({ band: "B0" }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /below required B1/);
});

test("FAIL-CLOSED: verify unreachable => deny", async () => {
  const fetchImpl = async (url) => {
    throw new Error("ECONNREFUSED");
  };
  const h = await hookWith(policy(), fetchImpl);
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /fail-closed: verify unreachable/);
});

test("FAIL-CLOSED: verify HTTP 500 => deny", async () => {
  const h = await hookWith(policy(), fetcher({ verifyFail: true }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /fail-closed: verify HTTP 500/);
});

test("deny: no grant for agent/resource", async () => {
  const h = await hookWith(policy(), fetcher());
  const r = await h.authorize({ agent: "did:web:stranger.example", resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /no grant/);
});

test("deny: per-spend cap", async () => {
  const h = await hookWith(policy(), fetcher());
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 6, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /per-spend cap/);
});

test("deny: daily cap uses runtime state (the YAML-snapshot gap)", async () => {
  const h = await hookWith(policy(), fetcher());
  await h.authorize({ agent: CRAWLER, resource: "x402:fetch", amountUsd: 3, atc: {} });
  const r2 = await h.authorize({ agent: CRAWLER, resource: "x402:fetch", amountUsd: 2, atc: {} }); // 3+2 > 4
  assert.equal(r2.allow, false);
  assert.match(r2.reason, /daily cap/);
});

test("deny: total budget exhausted", async () => {
  const p = policy(`
budget:
  total_usd: 5
  per_spend_max_usd: 4
authorizations:
  - agent: "${BOT}"
    resources: ["solana:transfer"]
    max_usd_per_day: 0
    trust_band_min: null
`);
  const h = await hookWith(p, fetcher());
  await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 4, atc: {} });
  const r2 = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 2, atc: {} });
  assert.equal(r2.allow, false);
  assert.match(r2.reason, /total budget/);
});

test("deny: agent revoked", async () => {
  const h = await hookWith(policy(), fetcher({ revoked: true }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /revoked/);
});

test("revocation down: fail_closed=true denies, fail_closed=false allows with warning", async () => {
  const h1 = await hookWith(policy(), fetcher({ revFail: true }));
  const r1 = await h1.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r1.allow, false);
  assert.match(r1.reason, /fail-closed: revocation/);

  const p2 = policy(POLICY_YAML.replace("fail_closed: true", "fail_closed: false"));
  const h2 = await hookWith(p2, fetcher({ revFail: true }));
  const r2 = await h2.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r2.allow, true);
});

test("band unavailable while threshold required => deny (fail-closed)", async () => {
  const fetchImpl = async (url, init) =>
    String(url).includes("/revocation")
      ? { ok: true, status: 200, json: async () => ({ revoked: false }) }
      : signedVerifyResponse(init.body, { band: null });
  const h = await hookWith(policy(), fetchImpl);
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /unavailable/);
});

test("crawler without band requirement still gets verified and allowed", async () => {
  const h = await hookWith(policy(), fetcher());
  const r = await h.authorize({ agent: CRAWLER, resource: "x402:fetch", amountUsd: 1, atc: {} });
  assert.equal(r.allow, true); // verify ran (would deny if unreachable — covered above)
});

test("receipt tamper detection", async () => {
  const h = await hookWith(policy(), fetcher());
  const r = await h.authorize({ agent: CRAWLER, resource: "x402:fetch", amountUsd: 1, atc: {} });
  const tampered = { ...r.receipt, amount_usd: 0.01 };
  assert.equal(h.verifyReceipt(tampered), false);
});

test("external keypair: receipts verify with the operator key, not the ephemeral one", async () => {
  const opKp = makeKeyPair();
  const h = await hookWith(policy(), fetcher(), { keyPair: opKp });
  const r = await h.authorize({ agent: CRAWLER, resource: "x402:fetch", amountUsd: 1, atc: {} });
  assert.equal(r.allow, true);
  assert.equal(verifyReceipt(r.receipt, opKp.publicKey), true);
  assert.equal(h.publicKey, opKp.publicKey, "hook signs with the operator key when injected");
});

// ---- RFC-ATC v3 §5.2 — verdict scope binding (motivated by minia2auk's
//      review, parthod0x/satroot#2: an unbound verdict_id is a bearer token
//      that a $0.01 route can mint and a $50 route would accept) ----

test("§5.2 scope binding: verdict for another resource => deny (fail-closed)", async () => {
  const h = await hookWith(policy(), fetcher({ verify: { resourceOverride: "solana:other-expensive-route" } }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /verdict resource mismatch/);
});

test("§5.2 scope binding: verdict for another amount => deny (fail-closed)", async () => {
  const h = await hookWith(policy(), fetcher({ verify: { amountOverride: 0.01 } }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /verdict amount mismatch/);
});

test("§5.2 scope binding: verdict signed by a non-pinned key => deny", async () => {
  const h = await hookWith(policy(), fetcher({ verify: { key: makeKeyPair() } }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /verdict signature invalid/);
});

test("§5.2 scope binding: replayed verdict (stale challenge) => deny without seller state", async () => {
  let captured = null;
  const fetchImpl = fetcher({
    onVerify: (init) => {
      if (captured) {
        return { ok: true, status: 200, json: async () => captured };
      }
      const req = JSON.parse(init.body);
      const verdict = {
        v: 1, verdict_id: "vrg_test_001", band: "B2",
        challenge: req.challenge, resource: req.resource, amount_usd: req.amount_usd,
        issued_at: new Date().toISOString(), expires_in: 300,
      };
      const signed = signVerdict(verdict, VKEY.privateKey);
      captured = { verified: true, band: "B2", verdict_id: verdict.verdict_id, verdict, verdict_sig: signed.verdict_sig };
      return { ok: true, status: 200, json: async () => captured };
    },
  });
  const h = await hookWith(policy(), fetchImpl);
  const r1 = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r1.allow, true, "first presentation with fresh challenge allows");
  const r2 = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r2.allow, false, "replay of the first verdict must deny");
  assert.match(r2.reason, /challenge mismatch/);
});

test("§5.2 scope binding: legacy unsigned verifier response => deny under strict default", async () => {
  const h = await hookWith(policy(), fetcher({ verify: { unsigned: true } }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, false);
  assert.match(r.reason, /verdict scope binding missing/);
});

test("§5.2 scope binding: off => legacy unsigned response accepted (documented migration opt-out)", async () => {
  const p = policy(POLICY_YAML.replace("scope_binding: strict", "scope_binding: off"));
  const h = await hookWith(p, fetcher({ verify: { unsigned: true } }));
  const r = await h.authorize({ agent: BOT, resource: "solana:transfer", amountUsd: 1, atc: {} });
  assert.equal(r.allow, true, "explicit opt-out keeps the pre-§5.2 flow working");
});

// ---- zero-dep fallback regression (the mini-parser must agree with the
//      `yaml` package path — tracked after the 2026-10-17 post-push audit) ----

import { parseMiniYaml } from "../src/bridge.mjs";

test("fallback mini-parser: inline comments, null keyword, flow lists", () => {
  const d = parseMiniYaml([
    "budget:",
    "  total_usd: 50       # ceiling for the whole launch",
    "authorizations:",
    '  - agent: "did:web:x.example"   # primary checkout bot',
    '    resources: ["solana:transfer", "x402:*"]',
    "    trust_band_min: null      # no band requirement",
    "    max_usd_per_day: 10",
    "  - agent: did:web:y.example#notacomment",
    "    trust_band_min: B1",
  ].join("\n"));
  assert.equal(d.budget.total_usd, 50);
  assert.equal(d.authorizations[0].agent, "did:web:x.example");
  assert.deepEqual(d.authorizations[0].resources, ["solana:transfer", "x402:*"]);
  assert.equal(d.authorizations[0].trust_band_min, null);
  assert.equal(d.authorizations[0].max_usd_per_day, 10);
  // `#` without preceding whitespace is part of the value (YAML rule)
  assert.equal(d.authorizations[1].agent, "did:web:y.example#notacomment");
  assert.equal(d.authorizations[1].trust_band_min, "B1");
});

test("fallback mini-parser normalizes identically to the active YAML path", () => {
  const viaFallback = normalizePolicy(parseMiniYaml(POLICY_YAML));
  const viaActivePath = policy(); // uses `yaml` when installed, fallback otherwise
  assert.deepEqual(viaFallback, viaActivePath); // includes policy_sha256
});

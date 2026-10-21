// authority514.test.mjs — tests mirroring solana-foundation/pay#514 semantics
// for the UTA-backed SpendingAuthority reference.
//
// Covers the contract from docs/external-spending-authority.md:
//   1. allow path  -> signed receipt bound to the full fact set
//   2. replay      -> new attempt on a claimed operation fails closed
//   3. headers     -> Authorization/Cookie/x402-payment rejected; dup
//                     case-insensitive names rejected
//   4. scheme gate -> non-exact / non-V2 offers denied
//   5. fail-closed -> verify unreachable maps to unavailable (never allow)
//   6. deadline    -> slow policy denies with unavailable
//   7. validation  -> operation_id charset, amount_atomic integer string
//   8. allowlists  -> asset/network/recipient + execution_network match
//   9. receipts    -> offer_sha256 + attempt binding present
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

import { createUtaHook, loadPolicy } from "../src/bridge.mjs";
import { createSpendAuthority, validateSpendRequest } from "../src/spend514.mjs";

const POLICY_YAML = `
budget:
  total_usd: 50
  per_spend_max_usd: 1.5
revocation:
  check_url: REPLACED_AT_RUNTIME_REV
  fail_closed: true
uta:
  verify_url: REPLACED_AT_RUNTIME
  scope_binding: off
authorizations:
  - agent: did:web:caller.test
    resources: ["*"]
    trust_band_min: B1
    max_usd_per_day: 10
`;

function spend(over = {}) {
  return {
    operation_id: "op-buy-1",
    attempt_id: "att-1",
    caller_id: "did:web:caller.test",
    request: { method: "GET", url: "https://api.example.com/weather", headers: [["accept", "application/json"]], body: null },
    amount_atomic: "1000000", // 1.000000 USDC at 6 decimals
    asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    execution_network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    recipient: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    accepted: {
      scheme: "exact",
      x402_version: 2,
      resource_information: { url: "https://api.example.com/weather" },
      max_amount_required: "1000000",
    },
    ...over,
  };
}

async function withUta(t, handler) {
  const srv = createServer((req, res) => {
    if (req.url === "/revocation") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ revoked: false }));
      return;
    }
    handler(req, res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  t.after(() => srv.close());
  const port = srv.address().port;
  const dir = mkdtempSync(join(tmpdir(), "spend514-"));
  const path = join(dir, "policy.yaml");
  writeFileSync(path, POLICY_YAML
    .replace("REPLACED_AT_RUNTIME_REV", `http://127.0.0.1:${port}/revocation`)
    .replace("REPLACED_AT_RUNTIME", `http://127.0.0.1:${port}/verify`));
  const policy = await loadPolicy(path);
  return { policy, verifyUrl: `http://127.0.0.1:${port}/verify` };
}

const OK_VERIFY = (req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({
    verified: true, band: "B2", verdict_id: "v-123",
  }));
};
const DOWN_VERIFY = (req, res) => {
  res.destroy(); // connection reset = unreachable
};

test("validation: operation_id charset and amount_atomic integer string", () => {
  assert.equal(validateSpendRequest(spend()), null);
  assert.match(validateSpendRequest(spend({ operation_id: "bad id!" })), /operation_id/);
  assert.match(validateSpendRequest(spend({ amount_atomic: "1.5" })), /amount_atomic/);
  assert.match(validateSpendRequest(spend({ amount_atomic: "-2" })), /amount_atomic/);
});

test("allow path: receipt binds operation/attempt/offer and verifies pipeline", async (t) => {
  const { policy } = await withUta(t, OK_VERIFY);
  const hook = await createUtaHook({ policy });
  const auth = createSpendAuthority(hook);
  const r = await auth.authorize(spend());
  assert.equal(r.decision, "allow");
  assert.equal(r.unavailable, false);
  assert.equal(r.receipt.operation_id, "op-buy-1");
  assert.equal(r.receipt.attempt_id, "att-1");
  assert.equal(r.receipt.amount_atomic, "1000000");
  assert.ok(r.receipt.offer_sha256?.startsWith("sha256:"));
  assert.equal(r.receipt.asset, spend().asset);
});

test("replay: same operation, new attempt => fail closed", async (t) => {
  const { policy } = await withUta(t, OK_VERIFY);
  const hook = await createUtaHook({ policy });
  const auth = createSpendAuthority(hook);
  assert.equal((await auth.authorize(spend())).decision, "allow");
  const r2 = await auth.authorize(spend({ attempt_id: "att-2" }));
  assert.equal(r2.decision, "deny");
  assert.match(r2.reason, /already bound/);
});

test("hostile headers: Authorization / Cookie / x402-payment / dup case-insensitive", async (t) => {
  const { policy } = await withUta(t, OK_VERIFY);
  const auth = createSpendAuthority(await createUtaHook({ policy }));
  let n = 0;
  const fresh = () => spend({ operation_id: `op-hdr-${++n}` });
  for (const hdr of [["Authorization", "Bearer x"], ["cookie", "sid=1"], ["X-Payment", "b64"], ["x402-payment", "b64"]]) {
    const req = fresh();
    req.request.headers = [hdr];
    const r = await auth.authorize(req);
    assert.equal(r.decision, "deny", hdr[0]);
    assert.match(r.reason, /forbidden header/);
  }
  const dupReq = fresh();
  dupReq.request.headers = [["Accept", "a"], ["accept", "b"]];
  const r2 = await auth.authorize(dupReq);
  assert.match(r2.reason, /duplicate case-insensitive header/);
});

test("scheme gate: V1 and non-exact denied", async (t) => {
  const { policy } = await withUta(t, OK_VERIFY);
  const auth = createSpendAuthority(await createUtaHook({ policy }));
  const v1 = await auth.authorize(spend({ operation_id: "op-v1", accepted: { ...spend().accepted, x402_version: 1 } }));
  assert.match(v1.reason, /x402 version/);
  const other = await auth.authorize(spend({ operation_id: "op-eip", accepted: { ...spend().accepted, scheme: "eip3009" } }));
  assert.match(other.reason, /unsupported scheme/);
});

test("fail-closed: verify unreachable => unavailable (never allow)", async (t) => {
  const { policy } = await withUta(t, DOWN_VERIFY);
  const auth = createSpendAuthority(await createUtaHook({ policy }));
  const r = await auth.authorize(spend());
  assert.equal(r.decision, "deny");
  assert.equal(r.unavailable, true);
});

test("deadline: policy slower than timeout => unavailable", async (t) => {
  const { policy } = await withUta(t, (req, res) => setTimeout(() => OK_VERIFY(req, res), 300));
  const auth = createSpendAuthority(await createUtaHook({ policy }), { timeoutMs: 40 });
  const r = await auth.authorize(spend());
  assert.equal(r.decision, "deny");
  assert.equal(r.unavailable, true);
  assert.match(r.reason, /deadline/);
});

test("allowlists: recipient out of list denied; network mismatch denied", async (t) => {
  const { policy } = await withUta(t, OK_VERIFY);
  const auth = createSpendAuthority(await createUtaHook({ policy }), {
    spendRules: { recipients: ["AnotherSo11111111111111111111111111111111112"] },
  });
  const r = await auth.authorize(spend({ operation_id: "op-allow-1" }));
  assert.match(r.reason, /recipient not in allowlist/);

  const auth2 = createSpendAuthority(await createUtaHook({ policy }));
  const mismatch = await auth2.authorize(spend({ operation_id: "op-allow-2", execution_network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" }));
  assert.match(mismatch.reason, /execution_network/);
});

test("failed verification (bad band) => plain deny, claim retained", async (t) => {
  const { policy } = await withUta(t, (req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ verified: true, band: "B0", verdict_id: "v-low" }));
  });
  const auth = createSpendAuthority(await createUtaHook({ policy }));
  const r = await auth.authorize(spend());
  assert.equal(r.decision, "deny");
  assert.equal(r.unavailable, false);
  assert.ok(r.reason.includes("band") || r.reason.includes("below"));
  // the operation stays claimed even after a deny (never re-run as fresh)
  const r2 = await auth.authorize(spend({ attempt_id: "att-again" }));
  assert.match(r2.reason, /already bound/);
});

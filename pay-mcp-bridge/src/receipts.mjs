// Signed receipts for uta-pay-mcp-bridge.
// Ed25519 over a canonical-JSON form of the receipt (sorted keys recursively,
// RFC 8785-compatible for the ASCII subset receipts use; the full JCS
// implementation lives in the UTA verifier).
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify, createHash } from "node:crypto";

export function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

export function sha256Hex(str) {
  return createHash("sha256").update(str).digest("hex");
}

export function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey, // KeyObject
  };
}

function privToKey(priv) {
  if (typeof priv === "string" || Buffer.isBuffer(priv)) {
    // base64 or DER pkcs8
    const buf = Buffer.isBuffer(priv) ? priv : Buffer.from(
      /^[A-Za-z0-9+/=]+$/.test(priv.trim()) ? priv : priv, "base64");
    return createPrivateKey({ key: buf, format: "der", type: "pkcs8" });
  }
  return priv; // already a KeyObject
}

function pubToKey(pub) {
  if (typeof pub === "string" || Buffer.isBuffer(pub)) {
    const buf = Buffer.isBuffer(pub) ? pub : Buffer.from(pub, "base64");
    return createPublicKey({ key: buf, format: "der", type: "spki" });
  }
  return pub;
}

export function signReceipt(receipt, privateKey) {
  const payload = canonicalize(receipt);
  const sig = sign(null, Buffer.from(payload), privToKey(privateKey));
  return { ...receipt, receipt_sig: sig.toString("base64") };
}

export function verifyReceipt(signed, publicKey) {
  if (!signed || typeof signed !== "object") return false;
  const { receipt_sig, ...receipt } = signed;
  if (!receipt_sig) return false;
  const payload = canonicalize(receipt);
  try {
    const ok = verify(
      null,
      Buffer.from(payload),
      pubToKey(publicKey),
      Buffer.from(receipt_sig, "base64")
    );
    if (!ok) return false;
    // binding: receipt carries the hash of its own canonical form (tamper-evidence for logs)
    return signed.receipt_sha256 === undefined || signed.receipt_sha256 === sha256Hex(canonicalize(receipt));
  } catch {
    return false;
  }
}

// ---- signed verdicts (verifier -> seller), RFC-ATC v3 §5.2 ----
// Same canonical-JSON Ed25519 scheme as receipts, separate sig field name.
// The verdict MUST be bound to the transaction scope: {challenge, resource,
// amount_usd} — a verdict without scope binding is a bearer token that a
// cheap route can mint and an expensive route would accept until expiry.
export function signVerdict(verdict, privateKey) {
  const payload = canonicalize(verdict);
  const sig = sign(null, Buffer.from(payload), privToKey(privateKey));
  return { ...verdict, verdict_sig: sig.toString("base64") };
}

export function verifyVerdict(verdict, verdictSig, publicKey) {
  if (!verdict || typeof verdict !== "object" || !verdictSig) return false;
  const { verdict_sig, ...rest } = verdict; // tolerate the sig field being present
  if (verdict_sig && verdict_sig !== verdictSig) return false; // two sigs disagree => fail
  try {
    return verify(
      null,
      Buffer.from(canonicalize(rest)),
      pubToKey(publicKey),
      Buffer.from(verdictSig, "base64")
    );
  } catch {
    return false;
  }
}

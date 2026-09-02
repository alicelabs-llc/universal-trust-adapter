/**
 * trustVerifier.ts — UTA trust verification, fail-closed.
 *
 * POSTs the credential/trust-card to the UTA endpoint and returns the decision.
 * ANY error (network, timeout, malformed response) => DENY. Never open on doubt.
 *
 * Set UTA_VERIFY_URL to point at another UTA instance
 * (default: public endpoint https://www.marketnow.site/api/trust?action=verify).
 */

export const VERIFY_URL = process.env.UTA_VERIFY_URL ??
  "https://www.marketnow.site/api/trust?action=verify";

export const VERIFY_TIMEOUT_MS = Number(process.env.UTA_VERIFY_TIMEOUT ?? 5000);

export type TrustDecision =
  | { decision: "ALLOW"; response: Record<string, unknown> }
  | { decision: "DENY"; reason: string };

export async function verifyWithUTA(
  payload: Record<string, unknown>,
): Promise<TrustDecision> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const resp = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      return { decision: "DENY", reason: `UTA returned HTTP ${resp.status}` };
    }
    const body = (await resp.json()) as Record<string, unknown>;
    const allowed =
      body["allowed"] === true ||
      body["decision"] === "ALLOW" ||
      body["decision"] === "allow";
    return allowed
      ? { decision: "ALLOW", response: body }
      : { decision: "DENY", reason: `UTA verdict: ${JSON.stringify(body)}` };
  } catch (err) {
    // Fail-closed: unreachable UTA means the call does NOT happen.
    return { decision: "DENY", reason: `UTA unreachable: ${String(err)}` };
  } finally {
    clearTimeout(timer);
  }
}

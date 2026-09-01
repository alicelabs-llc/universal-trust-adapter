/**
 * UTA — Deno example: verify a credential using native fetch (zero deps).
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 * Run:  deno run --allow-net verify.ts <card-string>
 */
const card = Deno.args[0];
if (!card) {
  console.error('Usage: deno run --allow-net verify.ts <card-string>');
  Deno.exit(1);
}
const resp = await fetch('https://www.marketnow.site/api/trust?action=verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ card }),
});
const result = await resp.json();
console.log('Decision:  ', result.decision);
console.log('Format:    ', result.detected_format);
console.log('Issuer:    ', result.issuer);
if (result.failed_stage) console.log('Failed at: ', result.failed_stage);
Deno.exit(result.decision === 'PERMIT' ? 0 : result.decision === 'DENY' ? 1 : 2);

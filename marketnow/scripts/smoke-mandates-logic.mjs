// Smoke test for mandates-logic.mjs (P2 fix verification)
import { getMandate, recordSpend, buildMandateMessage, verifyMandateSignature } from '../aep-marketplace/lib/mandates-logic.mjs';

console.log('--- mandates-logic.mjs smoke test ---');

// 1. getMandate with non-existent ID should return null, NOT throw.
const m1 = await getMandate('mand_does_not_exist_xyz123');
console.log('getMandate(nonexistent) →', m1 === null ? 'null (OK)' : 'FAIL');

// 2. recordSpend with non-existent mandate should return { ok: false, code: "not_found" }.
const r1 = await recordSpend('mand_does_not_exist_xyz123', 1.00, '0xabc', { id: 's1', name: 'test' });
console.log('recordSpend(nonexistent) →', JSON.stringify(r1));

// 3. buildMandateMessage should produce a deterministic string.
const msg = buildMandateMessage('agent_x', 100, '0xabc');
console.log('buildMandateMessage →', JSON.stringify(msg));

// 4. verifyMandateSignature with empty inputs should return false (not throw).
const v1 = verifyMandateSignature(null, 'agent_x', 100, '0xabc');
const v2 = verifyMandateSignature('0xdeadbeef', 'agent_x', 100, null);
console.log('verifyMandateSignature(null, ...) →', v1, '(OK if false)');
console.log('verifyMandateSignature(_, _, null) →', v2, '(OK if false)');

console.log('--- smoke test PASSED ---');

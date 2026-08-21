/**
 * @marketnow/conformance
 * BLOQUE J: Conformance Suite
 */
import { issueATCv3, verifyATCv3, atcV3ToUTS, generateTestVectors } from '../adapters/atc-v3.js';
import { generateEd25519KeyPair, canonicalize, canonicalHash, sign, computeArtifactBinding } from '../core/crypto.js';

export interface ConformanceResult {
  total: number; passed: number; failed: number;
  results: Array<{ test: string; passed: boolean; reason?: string }>;
}

export function runConformance(caKeyPair?: any): ConformanceResult {
  const keys = caKeyPair || generateEd25519KeyPair();
  const results: ConformanceResult = { total: 0, passed: 0, failed: 0, results: [] };
  const run = (name: string, fn: () => boolean, reason?: string) => {
    results.total++;
    try {
      if (fn()) { results.passed++; results.results.push({ test: name, passed: true }); }
      else { results.failed++; results.results.push({ test: name, passed: false, reason: reason || 'failed' }); }
    } catch (e) { results.failed++; results.results.push({ test: name, passed: false, reason: String(e) }); }
  };

  const vectors = generateTestVectors(keys);
  for (const cred of vectors.positive) run(`positive: ${cred.credential_id}`, () => verifyATCv3(cred, keys.publicKeyPem).valid);
  for (const cred of vectors.negative) run(`negative: ${cred.credential_id}`, () => !verifyATCv3(cred, keys.publicKeyPem).valid);
  for (const m of vectors.mutations) run(`mutation: ${m.field}`, () => !verifyATCv3(m.credential, keys.publicKeyPem).valid);

  run('round-trip: subject.name', () => atcV3ToUTS(vectors.positive[0]).subject.name === vectors.positive[0].subject.agent_name);
  run('round-trip: assessment.score', () => atcV3ToUTS(vectors.positive[0]).assessment.result.score === vectors.positive[0].assessment.score);
  run('round-trip: format.raw', () => atcV3ToUTS(vectors.positive[0]).format.raw === vectors.positive[0]);
  run('JCS: deterministic', () => canonicalize({b:1,a:2}) === canonicalize({a:2,b:1}));
  run('JCS: no forward slash escape', () => !canonicalize({u:'a/b'}).includes('\\/'));
  run('JCS: numbers', () => canonicalize({i:42,f:3.14}).includes('42') && canonicalize({i:42}).includes('42'));
  run('domain: different sigs', () => sign({t:'x'}, keys.privateKeyPem, 'UTA-ATC-V3-CREDENTIAL') !== sign({t:'x'}, keys.privateKeyPem, 'UTA-ATC-V3-POP'));
  run('artifact: deterministic', () => computeArtifactBinding('a','b','c') === computeArtifactBinding('a','b','c'));
  run('artifact: different', () => computeArtifactBinding('a','b','c') !== computeArtifactBinding('x','b','c'));

  return results;
}

export function conformanceMatrix() {
  return [
    { format: 'ATC v3', parse: true, detect: true, schema: true, crypto: true, pop: true, provenance: true, revocation: true, roundtrip: true },
    { format: 'EAT-AI', parse: true, detect: true, schema: true, crypto: false, pop: false, provenance: false, revocation: false, roundtrip: true },
    { format: 'ZTA', parse: true, detect: true, schema: true, crypto: false, pop: false, provenance: false, revocation: true, roundtrip: true },
    { format: 'A2A', parse: true, detect: true, schema: true, crypto: false, pop: false, provenance: false, revocation: false, roundtrip: true },
    { format: 'MCP', parse: true, detect: true, schema: true, crypto: false, pop: false, provenance: false, revocation: false, roundtrip: true },
    { format: 'W3C VC', parse: true, detect: true, schema: true, crypto: false, pop: false, provenance: false, revocation: false, roundtrip: true },
    { format: 'OAuth', parse: true, detect: true, schema: true, crypto: false, pop: false, provenance: false, revocation: false, roundtrip: true },
    { format: 'SPIFFE', parse: true, detect: true, schema: true, crypto: false, pop: false, provenance: false, revocation: false, roundtrip: true },
  ];
}

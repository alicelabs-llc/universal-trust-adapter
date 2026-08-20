"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runConformance = runConformance;
exports.conformanceMatrix = conformanceMatrix;
/**
 * @marketnow/conformance
 * BLOQUE J: Conformance Suite
 */
const atc_v3_js_1 = require("../adapters/atc-v3.js");
const crypto_js_1 = require("../core/crypto.js");
function runConformance(caKeyPair) {
    const keys = caKeyPair || (0, crypto_js_1.generateEd25519KeyPair)();
    const results = { total: 0, passed: 0, failed: 0, results: [] };
    const run = (name, fn, reason) => {
        results.total++;
        try {
            if (fn()) {
                results.passed++;
                results.results.push({ test: name, passed: true });
            }
            else {
                results.failed++;
                results.results.push({ test: name, passed: false, reason: reason || 'failed' });
            }
        }
        catch (e) {
            results.failed++;
            results.results.push({ test: name, passed: false, reason: String(e) });
        }
    };
    const vectors = (0, atc_v3_js_1.generateTestVectors)(keys);
    for (const cred of vectors.positive)
        run(`positive: ${cred.credential_id}`, () => (0, atc_v3_js_1.verifyATCv3)(cred, keys.publicKeyPem).valid);
    for (const cred of vectors.negative)
        run(`negative: ${cred.credential_id}`, () => !(0, atc_v3_js_1.verifyATCv3)(cred, keys.publicKeyPem).valid);
    for (const m of vectors.mutations)
        run(`mutation: ${m.field}`, () => !(0, atc_v3_js_1.verifyATCv3)(m.credential, keys.publicKeyPem).valid);
    run('round-trip: subject.name', () => (0, atc_v3_js_1.atcV3ToUTS)(vectors.positive[0]).subject.name === vectors.positive[0].subject.agent_name);
    run('round-trip: assessment.score', () => (0, atc_v3_js_1.atcV3ToUTS)(vectors.positive[0]).assessment.result.score === vectors.positive[0].assessment.score);
    run('round-trip: format.raw', () => (0, atc_v3_js_1.atcV3ToUTS)(vectors.positive[0]).format.raw === vectors.positive[0]);
    run('JCS: deterministic', () => (0, crypto_js_1.canonicalize)({ b: 1, a: 2 }) === (0, crypto_js_1.canonicalize)({ a: 2, b: 1 }));
    run('JCS: no forward slash escape', () => !(0, crypto_js_1.canonicalize)({ u: 'a/b' }).includes('\\/'));
    run('JCS: numbers', () => (0, crypto_js_1.canonicalize)({ i: 42, f: 3.14 }).includes('42') && (0, crypto_js_1.canonicalize)({ i: 42 }).includes('42'));
    run('domain: different sigs', () => (0, crypto_js_1.sign)({ t: 'x' }, keys.privateKeyPem, 'UTA-ATC-V3-CREDENTIAL') !== (0, crypto_js_1.sign)({ t: 'x' }, keys.privateKeyPem, 'UTA-ATC-V3-POP'));
    run('artifact: deterministic', () => (0, crypto_js_1.computeArtifactBinding)('a', 'b', 'c') === (0, crypto_js_1.computeArtifactBinding)('a', 'b', 'c'));
    run('artifact: different', () => (0, crypto_js_1.computeArtifactBinding)('a', 'b', 'c') !== (0, crypto_js_1.computeArtifactBinding)('x', 'b', 'c'));
    return results;
}
function conformanceMatrix() {
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

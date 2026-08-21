"""Tests for the uta-python SDK."""

import json
import os
import sys
import unittest

# Add the package to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from uta_python import UTAVerifier, canonicalize, canonical_hash, ed25519_verify

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
VECTORS = os.path.join(ROOT, 'vectors')
KEYS_FILE = os.path.join(VECTORS, 'keys', 'manifest.json')


def load_keys():
    with open(KEYS_FILE) as f:
        return json.load(f)['keys']


def load_vector(subdir, name):
    path = os.path.join(VECTORS, subdir, f'{name}.json')
    with open(path) as f:
        return json.load(f)


class TestJCS(unittest.TestCase):
    def test_canonicalize_flat_object(self):
        v = load_vector('cross-lang', 'xlang-001-flat-object')
        self.assertEqual(canonicalize(v['payload']), v['verification_input'])

    def test_canonicalize_unicode_keys(self):
        v = load_vector('cross-lang', 'xlang-003-unicode-keys')
        self.assertEqual(canonicalize(v['payload']), v['verification_input'])

    def test_canonical_hash_matches(self):
        v = load_vector('cross-lang', 'xlang-001-flat-object')
        self.assertEqual(canonical_hash(v['payload']), v['canonical_sha256'])


class TestATCv3(unittest.TestCase):
    def setUp(self):
        self.keys = load_keys()
        self.ca_pem = self.keys['ca_ed25519']['public_key_pem']
        self.verifier = UTAVerifier(self.ca_pem)

    def test_valid_atc_v3(self):
        v = load_vector('positive', 'pos-001-atc-v3-valid')
        result = self.verifier.verify_credential(v)
        self.assertTrue(result.valid, msg=f'Issues: {result.issues}')

    def test_tampered_sig_atc_v3(self):
        v = load_vector('negative', 'neg-001-atc-tampered-sig')
        result = self.verifier.verify_credential(v)
        self.assertFalse(result.valid)

    def test_tampered_payload_atc_v3(self):
        v = load_vector('negative', 'neg-002-atc-tampered-payload')
        result = self.verifier.verify_credential(v)
        self.assertFalse(result.valid)

    def test_expired_atc_v3(self):
        v = load_vector('negative', 'neg-003-atc-expired')
        result = self.verifier.verify_credential(v)
        self.assertFalse(result.valid)

    def test_wrong_domain_atc_v3(self):
        v = load_vector('negative', 'neg-005-atc-wrong-domain')
        result = self.verifier.verify_credential(v)
        self.assertFalse(result.valid)


class TestJWT(unittest.TestCase):
    def setUp(self):
        self.keys = load_keys()
        self.verifier = UTAVerifier(self.keys['ca_ed25519']['public_key_pem'])

    def test_valid_jwt_eddsa(self):
        v = load_vector('positive', 'pos-004-jwt-eddsa-valid')
        # JWT vectors have 1-hour expiry — use skip_expiry for reproducibility
        result = self.verifier.verify_credential(v, skip_expiry=True)
        self.assertTrue(result.valid, msg=f'Issues: {result.issues}')

    def test_jwt_alg_none_rejected(self):
        v = load_vector('negative', 'neg-006-jwt-alg-none')
        result = self.verifier.verify_credential(v)
        self.assertFalse(result.valid)

    def test_jwt_hs256_rejected(self):
        v = load_vector('negative', 'neg-007-jwt-hs256')
        result = self.verifier.verify_credential(v)
        self.assertFalse(result.valid)


class TestW3CVC(unittest.TestCase):
    def setUp(self):
        self.keys = load_keys()
        self.verifier = UTAVerifier(self.keys['ca_ed25519']['public_key_pem'])

    def test_valid_vc(self):
        v = load_vector('positive', 'pos-005-vc-ed25519-valid')
        result = self.verifier.verify_credential(v)
        self.assertTrue(result.valid, msg=f'Issues: {result.issues}')

    def test_wrong_key_vc(self):
        v = load_vector('negative', 'neg-009-vc-wrong-key')
        result = self.verifier.verify_credential(v)
        self.assertFalse(result.valid)


class TestReceipt(unittest.TestCase):
    def test_valid_receipt(self):
        keys = load_keys()
        v = load_vector('positive', 'pos-007-receipt-valid')
        from uta_python import verify_receipt
        result = verify_receipt(v['input'], keys['gateway_ed25519']['public_key_pem'])
        self.assertTrue(result.valid, msg=f'Issues: {result.issues}')

    def test_tampered_receipt(self):
        keys = load_keys()
        v = load_vector('negative', 'neg-013-receipt-tampered-evidence-hash')
        from uta_python import verify_receipt
        result = verify_receipt(v['input'], keys['gateway_ed25519']['public_key_pem'])
        self.assertFalse(result.valid)


class TestCrossDomain(unittest.TestCase):
    def test_atc_sig_does_not_verify_in_pop_domain(self):
        keys = load_keys()
        v = load_vector('positive', 'pos-001-atc-v3-valid')
        cred = v['input']
        payload = {k: val for k, val in cred.items() if k != 'signatures'}
        sig = cred['signatures'][0]['value']
        # Try ATC sig in POP domain — must fail
        ok = ed25519_verify(payload, sig, keys['ca_ed25519']['public_key_pem'], 'UTA-ATC-V3-POP')
        self.assertFalse(ok, 'ATC signature unexpectedly verified in POP domain')


if __name__ == '__main__':
    unittest.main(verbosity=2)

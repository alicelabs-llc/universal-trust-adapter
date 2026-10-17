r"""
test_fail_closed.py — regression tests for langchain-uta-middleware.

Invariant under test: NO tool call is ever executed because verification was
unavailable, errored, returned non-JSON, an invalid verdict, or a score below
policy. Every one of those paths must raise UTADenied BEFORE the wrapped tool
runs.

Run: python3 -m unittest test_fail_closed -v
Requires: langchain-core (for the wrapper tests). No network access — the
HTTP layer is stubbed.
"""
from __future__ import annotations

import json
import unittest
import urllib.error
import urllib.request
from unittest import mock
from urllib.error import URLError

import langchain_uta_middleware as m


class _FakeResp:
    def __init__(self, body: bytes, status: int = 200):
        self._body = body
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class _CountingTool:
    """Minimal LangChain-compatible tool double that counts invocations."""
    name = "counting_tool"

    def __init__(self):
        self.calls: list = []

    def invoke(self, inp):
        self.calls.append(inp)
        return {"echo": inp}


VALID_OK = {"valid": True, "uts": {"trust": {"score": 85}}}


class VerifyLayerTests(unittest.TestCase):
    """verify_with_uta must fail closed on every transport/parse failure."""

    def test_unreachable_raises_denied(self):
        with mock.patch.object(urllib.request, "urlopen", side_effect=URLError("conn refused")):
            with self.assertRaises(m.UTADenied) as ctx:
                m.verify_with_uta({"card": "x"})
        self.assertIn("unreachable", str(ctx.exception))

    def test_timeout_raises_denied(self):
        import socket
        with mock.patch.object(urllib.request, "urlopen", side_effect=socket.timeout("timed out")):
            with self.assertRaises(m.UTADenied):
                m.verify_with_uta({"card": "x"})

    def test_http_500_raises_denied(self):
        with mock.patch.object(
            urllib.request, "urlopen",
            side_effect=urllib.error.HTTPError(m.VERIFY_URL, 500, "boom", {}, None),
        ):
            with self.assertRaises(m.UTADenied):
                m.verify_with_uta({"card": "x"})

    def test_non_json_body_raises_denied(self):
        with mock.patch.object(urllib.request, "urlopen", return_value=_FakeResp(b"<html>502</html>")):
            with self.assertRaises(m.UTADenied):
                m.verify_with_uta({"card": "x"})

    def test_error_status_with_json_body_still_parsed(self):
        # urlopen succeeded with a JSON error envelope: layer returns it,
        # the wrapper layer must deny on valid != True.
        body = json.dumps({"valid": False, "warnings": ["signature mismatch"]}).encode()
        with mock.patch.object(urllib.request, "urlopen", return_value=_FakeResp(body)):
            out = m.verify_with_uta({"card": "x"})
        self.assertFalse(out["valid"])


class WrapperTests(unittest.TestCase):
    """uta_verified(tool) must deny BEFORE invoking the wrapped tool."""

    def _wrap(self, tool, **kw):
        return m.uta_verified(tool, **kw)

    def test_happy_path_invokes_tool(self):
        tool = _CountingTool()
        guarded = self._wrap(tool, trust_credential={"card": "c"})
        with mock.patch.object(urllib.request, "urlopen", return_value=_FakeResp(json.dumps(VALID_OK).encode())):
            out = guarded.invoke("hi")
        self.assertEqual(out, {"echo": "hi"})
        self.assertEqual(len(tool.calls), 1)

    def test_no_credential_denies_without_invoking(self):
        tool = _CountingTool()
        guarded = self._wrap(tool, trust_credential=None)
        with self.assertRaises(m.UTADenied) as ctx:
            guarded.invoke("hi")
        self.assertIn("no trust credential", str(ctx.exception))
        self.assertEqual(len(tool.calls), 0)

    def test_unreachable_denies_without_invoking(self):
        tool = _CountingTool()
        guarded = self._wrap(tool, trust_credential={"card": "c"})
        with mock.patch.object(urllib.request, "urlopen", side_effect=URLError("down")):
            with self.assertRaises(m.UTADenied):
                guarded.invoke("hi")
        self.assertEqual(len(tool.calls), 0)

    def test_invalid_verdict_denies_without_invoking(self):
        tool = _CountingTool()
        guarded = self._wrap(tool, trust_credential={"card": "c"})
        body = json.dumps({"valid": False, "warnings": ["tampered"]}).encode()
        with mock.patch.object(urllib.request, "urlopen", return_value=_FakeResp(body)):
            with self.assertRaises(m.UTADenied) as ctx:
                guarded.invoke("hi")
        self.assertIn("invalid trust card", str(ctx.exception))
        self.assertEqual(len(tool.calls), 0)

    def test_score_below_minimum_denies_without_invoking(self):
        tool = _CountingTool()
        guarded = self._wrap(tool, trust_credential={"card": "c"}, min_trust_score=90)
        body = json.dumps({"valid": True, "uts": {"trust": {"score": 42}}}).encode()
        with mock.patch.object(urllib.request, "urlopen", return_value=_FakeResp(body)):
            with self.assertRaises(m.UTADenied) as ctx:
                guarded.invoke("hi")
        self.assertIn("42 < 90", str(ctx.exception))
        self.assertEqual(len(tool.calls), 0)

    def test_missing_score_field_denies_without_invoking(self):
        tool = _CountingTool()
        guarded = self._wrap(tool, trust_credential={"card": "c"})
        body = json.dumps({"valid": True, "uts": {"trust": {}}}).encode()
        with mock.patch.object(urllib.request, "urlopen", return_value=_FakeResp(body)):
            with self.assertRaises(m.UTADenied):
                guarded.invoke("hi")
        self.assertEqual(len(tool.calls), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)

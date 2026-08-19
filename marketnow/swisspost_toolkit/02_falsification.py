#!/usr/bin/env python3
"""
Motor de Falsificación — verifica cada hallazgo antes de reportarlo.
Principio: un hallazgo sin intento de falsificación no es un hallazgo.
"""

import json
import os
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class VerificationResult:
    finding_id: str
    original_confidence: str
    final_confidence: str
    verdict: str  # REPORT | DISCARD | NEEDS_DYNAMIC | INFORMATIVE
    reason: str
    yeswehack_eligible: bool
    report_scope: str  # SOURCE_CODE | PROTOCOL | SPECIAL | OUT_OF_SCOPE


class FalsificationEngine:
    def __init__(self, findings: list[dict], source_roots: list[str] = None):
        self.findings = findings
        self.roots = source_roots or []
        self.results: list[VerificationResult] = []

    def run(self) -> list[VerificationResult]:
        for i, f in enumerate(self.findings):
            r = self._verify(f, str(i))
            self.results.append(r)
        return self.results

    def _verify(self, f: dict, fid: str) -> VerificationResult:
        category = f.get("category", "")
        confidence = f.get("confidence", "POSSIBLE")

        if category == "TIMING":
            return self._verify_timing(f, fid, confidence)
        elif category == "KDF":
            return self._verify_kdf(f, fid, confidence)
        elif category == "VALIDATION":
            return self._verify_validation(f, fid, confidence)
        elif category == "CRYPTO_MISUSE":
            return self._verify_crypto_misuse(f, fid, confidence)
        else:
            return VerificationResult(fid, confidence, "POSSIBLE", "NEEDS_DYNAMIC", "Categoría sin verificación automática.", False, "SOURCE_CODE")

    def _verify_timing(self, f: dict, fid: str, confidence: str) -> VerificationResult:
        filepath = f.get("file", "")
        desc = f.get("description", "")

        if "/test/" in filepath.replace("\\", "/"):
            return VerificationResult(fid, confidence, "FALSE_POSITIVE", "DISCARD", "Archivo en tests.", False, "OUT_OF_SCOPE")

        imm_source = self._find_source("ImmutableByteArray.java")
        ct_verified = self._check_constant_time_in_source(imm_source) if imm_source else None

        if ct_verified == "CONSTANT_TIME":
            return VerificationResult(fid, confidence, "FALSE_POSITIVE", "DISCARD", "equals() constant-time detectado.", False, "OUT_OF_SCOPE")
        elif ct_verified == "NOT_CONSTANT_TIME":
            confidence = "CONFIRMED" if confidence in ("PROBABLE", "CONFIRMED") else "PROBABLE"

        desc_lower = desc.lower()
        metadata_words = {"id", "eventid", "electionevent", "tenantid", "versionid"}
        secret_words = {"key", "secret", "password", "token", "hash", "signature", "mac"}

        has_metadata = any(w in desc_lower for w in metadata_words)
        has_secret = any(w in desc_lower for w in secret_words)

        if has_metadata and not has_secret:
            return VerificationResult(fid, confidence, "FALSE_POSITIVE", "DISCARD", "Comparación de metadata/ID, sin secreto.", False, "OUT_OF_SCOPE")

        if not ct_verified:
            return VerificationResult(
                fid,
                "POSSIBLE",
                "POSSIBLE",
                "NEEDS_DYNAMIC",
                "No se pudo verificar ImmutableByteArray.java automáticamente; validar manualmente equals().",
                False,
                "SOURCE_CODE",
            )

        return VerificationResult(
            fid,
            confidence,
            confidence,
            "REPORT" if confidence in ("CONFIRMED", "PROBABLE") else "NEEDS_DYNAMIC",
            "Comparación potencialmente no constant-time sobre tipo criptográfico.",
            confidence in ("CONFIRMED", "PROBABLE"),
            "SOURCE_CODE",
        )

    def _verify_kdf(self, f: dict, fid: str, confidence: str) -> VerificationResult:
        desc = f.get("description", "")
        if "lambda/4" in desc or "lambda / 4" in desc:
            return VerificationResult(
                fid,
                confidence,
                "INFORMATIVE",
                "INFORMATIVE",
                "lambda/4 produce más bytes que lambda/8 mínimo; no debilita seguridad por sí solo.",
                False,
                "OUT_OF_SCOPE",
            )
        return VerificationResult(fid, confidence, "POSSIBLE", "NEEDS_DYNAMIC", "Verificar contra spec del protocolo.", False, "SOURCE_CODE")

    def _verify_validation(self, f: dict, fid: str, confidence: str) -> VerificationResult:
        filepath = f.get("file", "")
        if "/test/" in filepath.replace("\\", "/"):
            return VerificationResult(fid, confidence, "FALSE_POSITIVE", "DISCARD", "Archivo de test.", False, "OUT_OF_SCOPE")

        if "secure-data-manager" in filepath.replace("\\", "/"):
            return VerificationResult(
                fid,
                confidence,
                "POSSIBLE",
                "NEEDS_DYNAMIC",
                "SDM suele ser interno; demostrar vector real dentro del modelo de amenaza.",
                False,
                "SOURCE_CODE",
            )

        return VerificationResult(fid, confidence, "POSSIBLE", "NEEDS_DYNAMIC", "Requiere PoC dinámico en endpoint real.", False, "SOURCE_CODE")

    def _verify_crypto_misuse(self, f: dict, fid: str, confidence: str) -> VerificationResult:
        filepath = f.get("file", "")
        desc = f.get("description", "")
        is_test = "/test/" in filepath.replace("\\", "/")

        if is_test:
            return VerificationResult(fid, confidence, "FALSE_POSITIVE", "DISCARD", "Archivo de test.", False, "OUT_OF_SCOPE")

        if "ECB" in desc and confidence == "CONFIRMED":
            return VerificationResult(fid, confidence, "CONFIRMED", "REPORT", "ECB en producción (si contexto crítico).", True, "SOURCE_CODE")

        if "Random()" in desc:
            return VerificationResult(fid, confidence, "POSSIBLE", "NEEDS_DYNAMIC", "new Random() puede ser no-crypto; validar contexto.", False, "SOURCE_CODE")

        return VerificationResult(
            fid,
            confidence,
            confidence,
            "NEEDS_DYNAMIC" if confidence == "POSSIBLE" else "REPORT",
            "Verificar contexto de uso antes de reportar.",
            confidence == "CONFIRMED",
            "SOURCE_CODE",
        )

    def _find_source(self, filename: str) -> Optional[str]:
        for root in self.roots:
            for dp, _, fs in os.walk(root):
                if filename in fs:
                    return os.path.join(dp, filename)
        return None

    def _check_constant_time_in_source(self, filepath: str) -> str:
        try:
            with open(filepath, encoding="utf-8", errors="ignore") as f:
                source = f.read()
        except Exception:
            return "UNKNOWN"

        equals_match = re.search(
            r"(?:@Override\s+)?(?:public\s+)?boolean\s+equals\s*\(.*?\)(.*?)(?=\n\s*(?:@|public|private|protected|\}))",
            source,
            re.DOTALL,
        )
        if not equals_match:
            return "UNKNOWN"

        body = equals_match.group(1).lower()
        ct_indicators = ["messagedigest.isequal", "arrays.constanttimeareequal", "constanttime", "constanttimecompare"]
        nct_indicators = ["arrays.equals(", "return bytes.equals(", ".equals(other.", "super.equals("]

        if any(ind in body for ind in ct_indicators):
            return "CONSTANT_TIME"
        if any(ind in body for ind in nct_indicators):
            return "NOT_CONSTANT_TIME"
        return "UNKNOWN"

    def report(self) -> dict:
        to_report = [r for r in self.results if r.verdict == "REPORT"]
        informative = [r for r in self.results if r.verdict == "INFORMATIVE"]
        needs_dyn = [r for r in self.results if r.verdict == "NEEDS_DYNAMIC"]
        discarded = [r for r in self.results if r.verdict == "DISCARD"]

        return {
            "total_verified": len(self.results),
            "to_report": len(to_report),
            "informative": len(informative),
            "needs_dynamic_testing": len(needs_dyn),
            "discarded_false_positives": len(discarded),
            "eligible_for_yeswehack": [
                {"id": r.finding_id, "scope": r.report_scope, "reason": r.reason[:100]}
                for r in to_report
                if r.yeswehack_eligible
            ],
            "details": [
                {
                    "id": r.finding_id,
                    "verdict": r.verdict,
                    "confidence": f"{r.original_confidence} → {r.final_confidence}",
                    "reason": r.reason,
                    "eligible": r.yeswehack_eligible,
                }
                for r in self.results
            ],
        }


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Uso: python 02_falsification.py raw_findings.json [root1 root2 ...]")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)

    roots = sys.argv[2:] if len(sys.argv) > 2 else []
    engine = FalsificationEngine(data["findings"], roots)
    engine.run()
    report = engine.report()

    output_path = "verified_findings.json"
    with open(output_path, "w", encoding="utf-8") as out:
        json.dump({"verification": report, "raw_findings": data["findings"]}, out, indent=2, ensure_ascii=False)

    print(f"\n{'='*55}")
    print("RESULTADOS DE VERIFICACIÓN")
    print(f"{'='*55}")
    print(f" Total verificados     : {report['total_verified']}")
    print(f" → REPORTAR            : {report['to_report']}")
    print(f" → Informativos        : {report['informative']}")
    print(f" → Requieren dinámica  : {report['needs_dynamic_testing']}")
    print(f" → Falsos positivos    : {report['discarded_false_positives']}")
    print(f"\n Elegibles YesWeHack   : {len(report['eligible_for_yeswehack'])}")
    print(f"\nGuardado: {output_path}")

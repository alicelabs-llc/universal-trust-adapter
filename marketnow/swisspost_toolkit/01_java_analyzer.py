#!/usr/bin/env python3
"""
SwissPost E-Voting — Analizador Java con rastreo de tipos
NO usa regex simples. Rastreo de contexto + tipos reales.
"""

import os
import re
import json
from dataclasses import dataclass
from typing import Optional


@dataclass
class TypedVar:
    name: str
    declared_type: str
    line: int


@dataclass
class Finding:
    file: str
    line: int
    category: str
    confidence: str
    description: str
    code_snippet: str
    falsification: str
    needs_dynamic: bool = False
    cvss_estimate: str = ""

    def to_dict(self):
        return self.__dict__


class TypeTracker:
    CRYPTO_TYPES = {
        "ImmutableByteArray",
        "byte[]",
        "BigInteger",
        "SecretKey",
        "PrivateKey",
        "ZqElement",
        "GqElement",
        "ElGamalCiphertext",
        "ImmutableList",
        "MessageDigest",
    }

    def __init__(self, source_lines: list[str]):
        self.lines = source_lines
        self.vars: dict[str, TypedVar] = {}
        self._parse()

    def _parse(self):
        decl_pattern = re.compile(
            r"(?:private|protected|public|final|static|\s)*"
            r"([\w<>\[\]]+(?:,\s*[\w<>\[\]]+)*)\s+"
            r"(\w+)\s*[=;,\(]"
        )
        for i, line in enumerate(self.lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            for m in decl_pattern.finditer(stripped):
                typ = m.group(1).strip()
                var = m.group(2).strip()
                if typ in {"if", "while", "for", "return", "new", "throw"}:
                    continue
                self.vars[var] = TypedVar(name=var, declared_type=typ, line=i)

    def type_of(self, var_name: str) -> Optional[str]:
        tv = self.vars.get(var_name)
        return tv.declared_type if tv else None


class Checks:
    @staticmethod
    def check_non_constant_time_equals(path: str, lines: list[str], tracker: TypeTracker) -> list[Finding]:
        findings = []
        equals_pat = re.compile(r"(\w+)\.equals\((\w+)\)")
        secret_keywords = {"password", "secret", "key", "token", "signature", "hash", "digest", "credential", "mac", "hmac"}

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue

            for m in equals_pat.finditer(stripped):
                var_a, var_b = m.group(1), m.group(2)
                type_a = tracker.type_of(var_a) or ""
                type_b = tracker.type_of(var_b) or ""

                is_immutable = "ImmutableByteArray" in type_a or "ImmutableByteArray" in type_b
                if not is_immutable:
                    continue

                combined = (var_a + var_b).lower()
                is_secret_context = any(kw in combined for kw in secret_keywords)
                context_lower = stripped.lower()
                is_check_state = "checkstate" in context_lower or "checkargument" in context_lower
                is_assertion = "assert" in context_lower

                confidence = "POSSIBLE"
                falsification = (
                    "Requiere verificar si ImmutableByteArray.equals() internamente usa Arrays.equals() "
                    "o MessageDigest.isEqual(). Si usa MessageDigest.isEqual() → mitigado."
                )

                if is_secret_context:
                    confidence = "PROBABLE"
                    falsification = (
                        "Verificar implementación de ImmutableByteArray.equals(). "
                        "Si es constant-time internamente → no es vulnerable."
                    )

                if is_check_state or is_assertion:
                    confidence = "POSSIBLE"
                    falsification = (
                        f"El uso está en checkState/assert ({stripped[:60]}), comparando probablemente IDs de sesión, "
                        f"no secretos. Verificar tipo real de {var_a} y {var_b}."
                    )

                findings.append(
                    Finding(
                        file=path,
                        line=i,
                        category="TIMING",
                        confidence=confidence,
                        description=(
                            f"Posible comparación no constant-time: {var_a}.equals({var_b}) — "
                            f"tipos: [{type_a}] [{type_b}]"
                        ),
                        code_snippet=_get_snippet(lines, i, context=2),
                        falsification=falsification,
                        needs_dynamic=True,
                        cvss_estimate="AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N → ~3.7 LOW",
                    )
                )

        return findings

    @staticmethod
    def check_kdf_byte_calculation(path: str, lines: list[str], tracker: TypeTracker) -> list[Finding]:
        findings = []
        kdf_pat = re.compile(r"(?:int|long)\s+\w+\s*=\s*.*lambda\s*/\s*(\d+)")

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            m = kdf_pat.search(stripped)
            if not m:
                continue
            divisor = int(m.group(1))

            if divisor == 4:
                nearby = " ".join(lines[max(0, i - 3): i + 3]).lower()
                has_explanation = "intentional" in nearby or "spec" in nearby or "extra" in nearby
                confidence = "PROBABLE" if not has_explanation else "POSSIBLE"
                falsification = (
                    "lambda/4 genera más bytes de los mínimos requeridos, pero NO debilita la distribución — "
                    "al contrario, reduce el sesgo estadístico. Verificar contra spec PDF sección KDFToZq."
                )
                if has_explanation:
                    falsification = "Hay comentario cercano que puede justificar el divisor. Revisar manualmente."

                findings.append(
                    Finding(
                        file=path,
                        line=i,
                        category="KDF",
                        confidence=confidence,
                        description=f"KDF usa lambda/{divisor}; spec estándar mínimo usa lambda/8.",
                        code_snippet=_get_snippet(lines, i, context=3),
                        falsification=falsification,
                        needs_dynamic=False,
                        cvss_estimate="Pendiente verificación vs spec — probablemente informativo",
                    )
                )
            elif divisor not in (8, 1, 2):
                findings.append(
                    Finding(
                        file=path,
                        line=i,
                        category="KDF",
                        confidence="POSSIBLE",
                        description=f"KDF usa divisor lambda/{divisor} — inusual.",
                        code_snippet=_get_snippet(lines, i, context=2),
                        falsification="Divisor poco común pero puede ser intencional según spec.",
                    )
                )

        return findings

    @staticmethod
    def check_input_validation(path: str, lines: list[str], tracker: TypeTracker) -> list[Finding]:
        findings = []
        mapping_pat = re.compile(r"@(Get|Post|Put|Delete|Patch)Mapping")
        param_pat = re.compile(r"@(PathVariable|RequestBody)\b")
        valid_pat = re.compile(r"@Valid\b")
        in_endpoint = False
        last_valid_line = -99

        for i, line in enumerate(lines, 1):
            if mapping_pat.search(line):
                in_endpoint = True
            if valid_pat.search(line):
                last_valid_line = i

            if in_endpoint and param_pat.search(line):
                has_valid_nearby = abs(last_valid_line - i) <= 3
                if not has_valid_nearby:
                    ptype = re.search(r"@(PathVariable|RequestBody)", line).group(1)
                    findings.append(
                        Finding(
                            file=path,
                            line=i,
                            category="VALIDATION",
                            confidence="POSSIBLE",
                            description=f"@{ptype} sin @Valid visible en ±3 líneas",
                            code_snippet=_get_snippet(lines, i, context=2),
                            falsification=(
                                "La validación puede existir en interceptor/filtro/global DTO. "
                                "Rastrear cadena completa."
                            ),
                            needs_dynamic=True,
                            cvss_estimate="No asignable sin confirmar ausencia total de validación",
                        )
                    )
                in_endpoint = False

        return findings

    @staticmethod
    def check_crypto_misuse(path: str, lines: list[str], tracker: TypeTracker) -> list[Finding]:
        findings = []
        patterns = [
            (re.compile(r'"[A-Z]+/ECB/'), "CRYPTO_MISUSE", "CONFIRMED", "Modo ECB detectado.", "Verificar si afecta datos sensibles.", "~7.5 HIGH"),
            (re.compile(r'MessageDigest\.getInstance\("(MD5|SHA-1|SHA1)"'), "CRYPTO_MISUSE", "PROBABLE", "Digest débil MD5/SHA-1.", "Puede ser checksum no-seguridad.", "Depende del contexto"),
            (re.compile(r'\bnew\s+Random\(\)'), "CRYPTO_MISUSE", "PROBABLE", "java.util.Random no criptográfico.", "Verificar contexto crypto real.", "~5.9 si crypto"),
            (re.compile(r'(?:key|iv|salt|password|secret)\s*=\s*"[^"]+"', re.IGNORECASE), "CRYPTO_MISUSE", "PROBABLE", "Posible secreto hardcodeado.", "Puede ser test/demo.", "~8.1 si producción"),
        ]

        is_test = "/test/" in path.replace("\\", "/")

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            for pat, cat, conf, desc, falsif, cvss in patterns:
                if pat.search(stripped):
                    actual_conf = "POSSIBLE" if is_test else conf
                    actual_falsif = f"[ARCHIVO DE TEST] {falsif}" if is_test else falsif
                    findings.append(
                        Finding(
                            file=path,
                            line=i,
                            category=cat,
                            confidence=actual_conf,
                            description=desc,
                            code_snippet=_get_snippet(lines, i, context=1),
                            falsification=actual_falsif,
                            cvss_estimate=cvss,
                        )
                    )
        return findings


class AnalysisEngine:
    CHECKS = [
        Checks.check_non_constant_time_equals,
        Checks.check_kdf_byte_calculation,
        Checks.check_input_validation,
        Checks.check_crypto_misuse,
    ]

    def __init__(self, roots: list[str]):
        self.roots = roots
        self.findings: list[Finding] = []
        self.files_analyzed = 0
        self.errors = []

    def run(self):
        for root in self.roots:
            if not os.path.exists(root):
                self.errors.append(f"Directorio no encontrado: {root}")
                continue
            for dp, _, fs in os.walk(root):
                for fname in fs:
                    if fname.endswith('.java'):
                        self._analyze_file(os.path.join(dp, fname))

    def _analyze_file(self, path: str):
        try:
            with open(path, encoding='utf-8', errors='ignore') as f:
                source = f.read()
        except Exception as e:
            self.errors.append(f"Error leyendo {path}: {e}")
            return

        lines = source.splitlines()
        self.files_analyzed += 1
        tracker = TypeTracker(lines)

        for check in self.CHECKS:
            try:
                self.findings.extend(check(path, lines, tracker))
            except Exception as e:
                self.errors.append(f"Error en check {check.__name__} sobre {path}: {e}")

    def summary(self) -> dict:
        by_confidence = {}
        by_category = {}
        for f in self.findings:
            by_confidence[f.confidence] = by_confidence.get(f.confidence, 0) + 1
            by_category[f.category] = by_category.get(f.category, 0) + 1

        return {
            'files_analyzed': self.files_analyzed,
            'total_findings': len(self.findings),
            'by_confidence': by_confidence,
            'by_category': by_category,
            'errors': self.errors[:10],
        }


def _get_snippet(lines: list[str], line_no: int, context: int = 2) -> str:
    start = max(0, line_no - context - 1)
    end = min(len(lines), line_no + context)
    snippet_lines = []
    for i, l in enumerate(lines[start:end], start + 1):
        marker = '>>>' if i == line_no else ' '
        snippet_lines.append(f"{marker} {i:4d} | {l}")
    return "\n".join(snippet_lines)


def save_results(engine: AnalysisEngine, output_path: str):
    data = {
        'summary': engine.summary(),
        'findings': [f.to_dict() for f in engine.findings],
    }
    with open(output_path, 'w', encoding='utf-8') as out:
        json.dump(data, out, indent=2, ensure_ascii=False)
    print(f"[+] Resultados guardados: {output_path}")
    return data


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='SwissPost E-Voting Java Analyzer')
    parser.add_argument('roots', nargs='+', help='Directorios raíz (e-voting, crypto-primitives)')
    parser.add_argument('--output', default='raw_findings.json')
    args = parser.parse_args()

    print(f"[*] Analizando: {args.roots}")
    engine = AnalysisEngine(args.roots)
    engine.run()
    data = save_results(engine, args.output)

    s = data['summary']
    print(f"\n{'='*50}")
    print(f"Archivos analizados : {s['files_analyzed']}")
    print(f"Hallazgos totales   : {s['total_findings']}")
    print(f"Por confianza       : {s['by_confidence']}")
    print(f"Por categoría       : {s['by_category']}")
    if s['errors']:
        print(f"Errores (primeros)  : {s['errors']}")

#!/usr/bin/env python3
"""
Generador de Reportes para YesWeHack — Swiss Post E-Voting.
"""

import json
import os
import sys
from datetime import datetime

TEMPLATES = {
    "TIMING": {
        "title_template": "Potential Timing Side-Channel in {component} via Non-Constant-Time Comparison",
        "scope": "Application Source Code",
        "protocol_phase": "Verify against protocol phases in spec before submitting",
        "references": [
            "Kocher 1996 Timing Attacks",
            "https://codahale.com/a-lesson-in-timing-attacks/",
            "OWASP WSTG-CRYP-04",
            "Java MessageDigest.isEqual docs",
        ],
        "impact_template": (
            "If comparison of {var_type} uses non-constant-time equality, "
            "an attacker with precise timing could infer {secret_value}."
        ),
        "required_PoC": "- Real runtime measurements\n- Statistical significance\n- Reproducible scripts/logs",
    },
    "KDF": {
        "title_template": "KDF Implementation Deviation: {component} — Spec vs. Implementation",
        "scope": "Application Source Code / Protocol",
        "protocol_phase": "Setup Phase — Key Derivation",
        "references": ["RFC 5869", "Protocol spec section KDFToZq", "NIST SP 800-108"],
        "impact_template": (
            "The KDF implementation at {file}:{line} uses {actual_formula} instead of {expected_formula}. "
            "Security impact must be demonstrated concretely."
        ),
        "required_PoC": "- Spec quote\n- Code line proof\n- Math proof of impact",
    },
    "VALIDATION": {
        "title_template": "Missing Input Validation on {endpoint} — {param_type} Parameter",
        "scope": "Application Source Code",
        "protocol_phase": "Online Phase",
        "references": ["OWASP Input Validation", "CWE-20", "Spring @Valid docs"],
        "impact_template": (
            "Endpoint {endpoint} at {file}:{line} accepts {param_type} without explicit @Valid. "
            "Requires concrete exploit and reachable attack path."
        ),
        "required_PoC": "- Show no global validation\n- Working payload\n- Concrete impact",
    },
    "CRYPTO_MISUSE": {
        "title_template": "Cryptographic Misuse: {algorithm} in {component}",
        "scope": "Application Source Code",
        "protocol_phase": "Depends on component",
        "references": ["NIST SP 800-131A", "CWE-327", "Swiss Post protocol requirements"],
        "impact_template": "Use of {algorithm} at {file}:{line} does not meet required crypto guarantees.",
        "required_PoC": "- Security-relevant context\n- Demonstrated weakness\n- Threat-model compatible scenario",
    },
}

YESWEHACK_CHECKLIST = """
## YesWeHack Submission Checklist
- [ ] Exact file + lines
- [ ] Protocol phase + spec section
- [ ] Threat model compatible
- [ ] Step-by-step exploit path
- [ ] Concrete impact
- [ ] PoC/logs/screenshots
- [ ] Not known issue
"""


class ReportGenerator:
    def __init__(self, verified_findings_path: str):
        with open(verified_findings_path, encoding="utf-8") as f:
            data = json.load(f)
        self.verification = data["verification"]
        self.raw_findings = data["raw_findings"]
        self.details = {d["id"]: d for d in self.verification["details"]}

    def generate_all(self, output_dir: str = "."):
        os.makedirs(output_dir, exist_ok=True)

        with open(os.path.join(output_dir, "EXECUTIVE_SUMMARY.md"), "w", encoding="utf-8") as f:
            f.write(self._executive_report())

        for i, finding in enumerate(self.raw_findings):
            fid = str(i)
            detail = self.details.get(fid, {})
            verdict = detail.get("verdict", "NEEDS_DYNAMIC")
            if verdict in ("REPORT", "NEEDS_DYNAMIC"):
                status = "READY" if verdict == "REPORT" else "DRAFT"
                fname = f"report_{status}_{fid}_{finding.get('category','UNK')}.md"
                with open(os.path.join(output_dir, fname), "w", encoding="utf-8") as f:
                    f.write(self._individual_report(finding, detail, fid))

    def _executive_report(self) -> str:
        v = self.verification
        date = datetime.now().strftime("%Y-%m-%d %H:%M UTC")
        lines = [
            "# Swiss Post E-Voting — Security Analysis Report",
            f"**Date**: {date}",
            "",
            "## Summary",
            f"- Findings analyzed: {v['total_verified']}",
            f"- Ready to report: {v['to_report']}",
            f"- Informative: {v['informative']}",
            f"- Need dynamic testing: {v['needs_dynamic_testing']}",
            f"- Discarded: {v['discarded_false_positives']}",
            "",
            YESWEHACK_CHECKLIST,
        ]
        return "\n".join(lines)

    def _individual_report(self, finding: dict, detail: dict, fid: str) -> str:
        category = finding.get("category", "UNKNOWN")
        template = TEMPLATES.get(category, TEMPLATES["CRYPTO_MISUSE"])
        filepath = finding.get("file", "unknown")
        component = os.path.basename(filepath).replace(".java", "")
        status = "⚠️ NEEDS DYNAMIC PoC" if detail.get("verdict") == "NEEDS_DYNAMIC" else "✅ READY TO REVIEW"

        vars_ = _safe_format_vars(finding)
        vars_["component"] = component

        lines = [
            f"# [{category}] {template['title_template'].format(**vars_)}",
            "",
            f"**Status**: {status}",
            f"**Confidence**: {detail.get('confidence', finding.get('confidence','POSSIBLE'))}",
            f"**File**: `{filepath}`",
            f"**Line**: {finding.get('line','?')}",
            "",
            "## Description",
            finding.get("description", ""),
            "",
            "## Code Evidence",
            "```java",
            finding.get("code_snippet", "(no snippet)"),
            "```",
            "",
            "## Falsification Analysis",
            finding.get("falsification", ""),
            "",
            f"Automatic verification: {detail.get('reason','N/A')}",
            "",
            "## Impact Template",
            template["impact_template"].format(**vars_),
            "",
            "## Required PoC",
            template["required_PoC"],
            "",
            "## References",
        ]
        for r in template["references"]:
            lines.append(f"- {r}")
        lines += ["", YESWEHACK_CHECKLIST]
        return "\n".join(lines)


def _safe_format_vars(finding: dict) -> dict:
    return {
        "file": finding.get("file", "unknown"),
        "line": finding.get("line", "?"),
        "component": os.path.basename(finding.get("file", "unknown.java")).replace(".java", ""),
        "var_type": "ImmutableByteArray",
        "secret_value": "[specify]",
        "actual_formula": "lambda/4",
        "expected_formula": "lambda/8",
        "endpoint": "[extract endpoint]",
        "param_type": "RequestBody/PathVariable",
        "algorithm": "[specify]",
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python 03_report_generator.py verified_findings.json [output_dir]")
        sys.exit(1)

    verified_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "reports"
    gen = ReportGenerator(verified_path)
    gen.generate_all(output_dir)
    print(f"Reportes listos en: {output_dir}/")

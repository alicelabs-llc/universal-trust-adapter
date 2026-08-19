#!/usr/bin/env python3
"""
SwissPost E-Voting — Pipeline completo de análisis
Uso:
  python run_analysis.py [directorio1] [directorio2] ...
Si no se especifican directorios, busca e-voting y crypto-primitives en el directorio actual.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime

# -- Verificar que los módulos del toolkit existen ----------------------------
TOOLKIT_DIR = Path(__file__).parent


def import_module_from_path(name, path):
    import importlib.util

    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


analyzer_mod = import_module_from_path("analyzer", TOOLKIT_DIR / "01_java_analyzer.py")
falsification_mod = import_module_from_path("falsification", TOOLKIT_DIR / "02_falsification.py")
report_mod = import_module_from_path("report", TOOLKIT_DIR / "03_report_generator.py")


# -- Pipeline -----------------------------------------------------------------
def banner():
    print("="*62)
    print("Swiss Post E-Voting - Security Analysis Pipeline")
    print("Bug Bounty: yeswehack.com/programs/swiss-post-evoting")
    print("="*62)


def step(n, title):
    print(f"\n{'-'*55}")
    print(f" PASO {n}: {title}")
    print(f"{'-'*55}")


def run_pipeline(roots: list, output_base: str = "analysis_output"):
    banner()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"{output_base}_{ts}"
    os.makedirs(output_dir, exist_ok=True)

    raw_path = os.path.join(output_dir, "1_raw_findings.json")
    verified_path = os.path.join(output_dir, "2_verified_findings.json")
    reports_dir = os.path.join(output_dir, "3_reports")

    # -- PASO 1: Análisis estático -----------------------------------------
    step(1, "Análisis estático con rastreo de tipos")
    print(f" Directorios: {roots}")

    t0 = time.time()
    engine = analyzer_mod.AnalysisEngine(roots)
    engine.run()
    elapsed = time.time() - t0

    data = analyzer_mod.save_results(engine, raw_path)
    s = data["summary"]

    print(f"\n OK Completado en {elapsed:.1f}s")
    print(f" Archivos analizados : {s['files_analyzed']}")
    print(f" Hallazgos crudos : {s['total_findings']}")
    print(f" Por confianza : {s['by_confidence']}")
    print(f" Por categoría : {s['by_category']}")

    if not engine.findings:
        print("\n INFO No se encontraron hallazgos. Verifica que los directorios sean correctos.")
        print(f" Errores: {s['errors'][:3]}")
        _write_run_summary(output_dir, roots, s, {}, 0, ts)
        return output_dir

    # -- PASO 2: Falsificación y verificación ------------------------------
    step(2, "Falsificación — eliminando falsos positivos")
    f_engine = falsification_mod.FalsificationEngine(data["findings"], roots)
    f_engine.run()
    v_report = f_engine.report()

    with open(verified_path, "w", encoding="utf-8") as out:
        json.dump({"verification": v_report, "raw_findings": data["findings"]}, out, indent=2, ensure_ascii=False)

    print(" OK Verificación completada")
    print(f" -> REPORTAR : {v_report['to_report']}")
    print(f" -> Informativos : {v_report['informative']}")
    print(f" -> Requieren PoC dinámico : {v_report['needs_dynamic_testing']}")
    print(f" -> Falsos positivos : {v_report['discarded_false_positives']}")
    print(f" -> Elegibles YesWeHack : {len(v_report['eligible_for_yeswehack'])}")

    # -- PASO 3: Generación de reportes ------------------------------------
    step(3, "Generando reportes formales")
    gen = report_mod.ReportGenerator(verified_path)
    gen.generate_all(reports_dir)

    # -- PASO 4: Resumen de próximos pasos ---------------------------------
    step(4, "Próximos pasos")
    needs_dyn = [d for d in v_report["details"] if d["verdict"] == "NEEDS_DYNAMIC"]
    ready = [d for d in v_report["details"] if d["verdict"] == "REPORT"]
    eligible = v_report["eligible_for_yeswehack"]

    print(f"""
HALLAZGOS LISTOS PARA REVISAR: {len(ready)}
{'-'*45}""")
    for item in ready:
        print(f" [R] [{item['id']}] {item['reason'][:100]}")

    print(f"""
REQUIEREN PoC DINÁMICO: {len(needs_dyn)}
{'-'*45}""")
    for item in needs_dyn[:5]:
        print(f" [D] [{item['id']}] {item['reason'][:100]}")
    if len(needs_dyn) > 5:
        print(f" ... y {len(needs_dyn)-5} más en {verified_path}")

    if eligible:
        print(f"""
ELEGIBLES PARA YESWEHACK: {len(eligible)}
{'-'*45}""")
        for item in eligible:
            print(f" [OK] [{item['id']}] Scope: {item['scope']}")
            print(f"    {item['reason'][:120]}")

    _write_run_summary(output_dir, roots, s, v_report, len(eligible), ts)

    print(f"""
{'='*55}
OUTPUT GENERADO EN: {output_dir}/
{'='*55}
[FILE] 1_raw_findings.json       -> Hallazgos crudos del analizador
[FILE] 2_verified_findings.json  -> Después de falsificación
[FILE] 3_reports/                -> Reportes formales para YesWeHack
[FILE] RUN_SUMMARY.md            -> Este resumen
""")

    return output_dir


def _write_run_summary(output_dir, roots, scan_summary, v_report, eligible_count, ts):
    lines = [
        "# Analysis Run Summary",
        f"**Date**: {ts}",
        f"**Roots**: {roots}",
        "",
        "## Scan",
        f"- Files analyzed: {scan_summary.get('files_analyzed', 0)}",
        f"- Raw findings: {scan_summary.get('total_findings', 0)}",
        f"- By confidence: {scan_summary.get('by_confidence', {})}",
        "",
        "## Verification",
    ]

    if v_report:
        lines += [
            f"- To report: {v_report.get('to_report', 0)}",
            f"- Informative: {v_report.get('informative', 0)}",
            f"- Needs dynamic: {v_report.get('needs_dynamic_testing', 0)}",
            f"- False positives: {v_report.get('discarded_false_positives', 0)}",
            f"- YesWeHack eligible: {eligible_count}",
        ]

    with open(os.path.join(output_dir, "RUN_SUMMARY.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# -- Entry point ---------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Swiss Post E-Voting — Full Security Analysis Pipeline")
    parser.add_argument("roots", nargs="*", help="Directorios raíz a analizar (default: e-voting crypto-primitives)")
    parser.add_argument("--output", default="analysis_output", help="Prefijo del directorio de salida")
    args = parser.parse_args()

    roots = args.roots if args.roots else ["e-voting", "crypto-primitives"]

    missing = [r for r in roots if not os.path.exists(r)]
    if missing:
        print(f"[WARN] Directorios no encontrados: {missing}")
        print(f" Ejecuta desde el directorio que contiene: {roots}")
        print(" O especifica rutas absolutas.")
        print("\n Ejemplo:")
        print(
            " python run_analysis.py C:/Users/Usuario/.openclaw/workspace/e-voting "
            "C:/Users/Usuario/.openclaw/workspace/crypto-primitives"
        )
        sys.exit(1)

    run_pipeline(roots, args.output)

#!/usr/bin/env python3
"""Verificador rapido para casos especificos."""

import sys
import os
import re


def check_immutable_byte_array(filepath: str):
    print("\n" + "=" * 60)
    print("ANALISIS: ImmutableByteArray.equals()")
    print(f"Archivo: {filepath}")
    print("=" * 60)

    if not os.path.exists(filepath):
        print(f"[X] Archivo no encontrado: {filepath}")
        return

    with open(filepath, encoding="utf-8", errors="ignore") as f:
        source = f.read()
    lines = source.splitlines()

    in_equals = False
    brace_depth = 0
    equals_lines = []
    equals_start = -1

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.search(r'(?:@Override\s*)?(?:public\s+)?boolean\s+equals\s*\(', stripped):
            in_equals = True
            equals_start = i
        if in_equals:
            equals_lines.append((i, line))
            brace_depth += stripped.count('{') - stripped.count('}')
            if equals_start != i and brace_depth <= 0:
                break

    if not equals_lines:
        print("[!] No se encontro metodo equals()")
        return

    print(f"\nMetodo equals() encontrado (linea {equals_start}):\n")
    for lineno, line in equals_lines:
        print(f" {lineno:4d} | {line.rstrip()}")

    body = "\n".join(l for _, l in equals_lines).lower()
    found_ct = any(x in body for x in ["messagedigest.isequal", "constanttime", "arrays.constanttimeareequal"])
    found_nct = any(x in body for x in ["arrays.equals(", "super.equals(", "=="])

    print("\nDIAGNOSTICO:")
    if "arrays.equals(" in body:
        print(" [X] Arrays.equals() - NO constant-time")
    if "messagedigest.isequal" in body:
        print(" [OK] MessageDigest.isEqual() - constant-time")

    print("\n" + "-" * 60)
    if found_ct and not found_nct:
        print("VEREDICTO: CONSTANT-TIME")
    elif found_nct and not found_ct:
        print("VEREDICTO: NO CONSTANT-TIME")
    else:
        print("VEREDICTO: AMBIGUO")


def check_kdf_service(filepath: str):
    print("\n" + "=" * 60)
    print("ANALISIS: KDFService.KDFToZq()")
    print(f"Archivo: {filepath}")
    print("=" * 60)

    if not os.path.exists(filepath):
        print(f"[X] Archivo no encontrado: {filepath}")
        return

    with open(filepath, encoding="utf-8", errors="ignore") as f:
        lines = f.read().splitlines()

    in_method = False
    method_lines = []
    for i, line in enumerate(lines, 1):
        if "KDFToZq" in line and ("public" in line or "private" in line):
            in_method = True
        if in_method:
            method_lines.append((i, line))
            if len(method_lines) > 5 and line.strip() == "}":
                break
            if len(method_lines) > 80:
                break

    if not method_lines:
        print("[!] No se encontro KDFToZq")
        return

    print("\nMetodo KDFToZq:")
    for lineno, line in method_lines[:30]:
        print(f" {lineno:4d} | {line.rstrip()}")

    n_formula = None
    for lineno, line in method_lines:
        m = re.search(r'int\s+n\s*=\s*(.+?);', line)
        if m:
            n_formula = (lineno, m.group(1).strip())
            break

    if n_formula:
        print(f"\nFormula de n (linea {n_formula[0]}): {n_formula[1]}")
        formula = n_formula[1].lower()
        if "lambda / 4" in formula or "lambda/4" in formula:
            print("VEREDICTO: Informativo (mas bytes, no debilidad por si sola).")
        elif "lambda / 8" in formula or "lambda/8" in formula:
            print("VEREDICTO: Formula estandar.")
        else:
            print("VEREDICTO: Formula inusual; revisar spec.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso:\n python quick_verify.py imm <ruta/ImmutableByteArray.java>\n python quick_verify.py kdf <ruta/KDFService.java>")
        sys.exit(0)

    mode = sys.argv[1].lower()
    filepath = sys.argv[2]

    if mode == "imm":
        check_immutable_byte_array(filepath)
    elif mode == "kdf":
        check_kdf_service(filepath)
    else:
        print("Modo desconocido: usa 'imm' o 'kdf'")

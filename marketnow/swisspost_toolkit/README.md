# Swiss Post E-Voting — Security Analysis Toolkit

Toolkit para análisis orientado a bug bounty (YesWeHack).

## Archivos
- `run_analysis.py` (pipeline completo)
- `01_java_analyzer.py` (análisis estático con rastreo de tipos)
- `02_falsification.py` (falsificación/verificación)
- `03_report_generator.py` (reportes)
- `quick_verify.py` (verificación puntual)

## Uso rápido
```bash
python swisspost_toolkit/run_analysis.py e-voting crypto-primitives
```

Salida:
- `1_raw_findings.json`
- `2_verified_findings.json`
- `3_reports/`
- `RUN_SUMMARY.md`

## Verificación puntual
```bash
python swisspost_toolkit/quick_verify.py imm "ruta/ImmutableByteArray.java"
python swisspost_toolkit/quick_verify.py kdf "ruta/KDFService.java"
```

## Nota
Los hallazgos `NEEDS_DYNAMIC` requieren PoC runtime antes de enviar a YesWeHack.

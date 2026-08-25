# Quarantine Decisions — Public Audit Record

> Signed, ordered, git-backed records of every Sentinel quarantine decision.

## Why this exists

In a review of MarketNow's article #4419959, @anp2network pointed out that "1.2 million checks and 80 quarantined items" was a strong business asset but a weak trust claim — held by the party asserting them, so nobody outside could derive a false positive rate or false negative rate from those numbers.

This directory is the fix. Every quarantine decision is now a signed, ordered, git-backed record. Third parties can:

1. **Count total quarantine decisions** in any time period
2. **Count appeals** — how many quarantined items were later un-quarantined
3. **Derive the false positive rate** — appeals with `appeal_decision='false_positive'` / total quarantines
4. **Track when rules change** — the L1.6 rule that triggered the false positive is documented so the same false positive shouldn't happen again
5. **Audit ordering** — records are git-committed, so commit history shows when each was added

## Structure

```
_data/quarantine_decisions/
├── MANIFEST.json                              # signed manifest with all records
├── README.md                                  # this file
└── 2026/
    └── 08/
        ├── 2026-08-15-qd_2026_08_15_001.json  # individual decision
        ├── 2026-08-16-qd_2026_08_16_002.json
        └── 2026-08-17-qd_2026_08_17_003.json
```

## Each record contains

- `decision_id`: unique ID
- `decision_date`: ISO 8601 timestamp
- `skill_id`, `skill_name`, `skill_repo`: what was quarantined
- `sentinel_score`: 0-10 score from Sentinel
- `sentinel_version`: which Sentinel version produced the decision
- `layers_run`: which audit layers ran
- `layer_findings`: per-layer results + notes
- `decision`: quarantine | allow | warn
- `decision_reason`: human-readable reason
- `decision_authority`: which layer fired
- `appealable`: bool
- `appeal_*` fields (if appeal was filed): appeal_status, appeal_decision, appeal_decision_date, appeal_reviewer, appeal_reason
- `record_sha256`: tamper-evident hash of the record itself

## How to audit

### Total quarantine decisions in August 2026
```bash
find _data/quarantine_decisions/2026/08/ -name "*.json" -not -name "MANIFEST*" | wc -l
```

### False positive rate
```python
import json, glob
records = [json.load(open(f)) for f in glob.glob('_data/quarantine_decisions/2026/08/*.json')]
total = len(records)
fp = sum(1 for r in records if r.get('appeal_decision') == 'false_positive')
print(f'FPR: {fp}/{total} = {fp/total*100:.1f}%')
```

## Immutability

Records are git-committed. Each record's `record_sha256` is computed over its own content (including itself, for tamper-evidence). If you modify a record, the hash will mismatch the manifest, which is itself content-addressed.

## Adding new records

The Sentinel engine writes a new record here every time it makes a quarantine decision. The file path follows `{year}/{month}/{date}-{decision_id}.json` so they sort naturally by date.

## License

MNNC-1.0 — see https://marketnow.site/LICENSE

## Contact

- Issues: security@alicelabs.site
- Appeals: https://marketnow.site/appeals?qd={decision_id}

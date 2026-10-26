# Movement data contract

Implementation: `src/domain/validation.ts`, `src/domain/metrics.ts`, `src/domain/repetitions.ts`, `src/domain/export.ts`.
Parameters: `src/domain/analysisConfig.ts` (mirrored in `matlab/rt_config.m` and `reference/python/rt_analysis.py`).

## 1. One file = one recording

A file contains timestamped angle samples for **one joint, one side and one movement**, in **degrees**.

| Joint | Movements |
|---|---|
| shoulder | flexion, extension, abduction |
| elbow, wrist, hip, knee | flexion, extension |
| ankle | dorsiflexion, plantarflexion |

Sides: `left`, `right`. Values are lowercase.

## 2. CSV format

```csv
timestamp,joint,side,movement,angleDeg
2026-10-26T10:00:00.000Z,shoulder,right,flexion,20
2026-10-26T10:00:00.100Z,shoulder,right,flexion,35
2026-10-26T10:00:00.200Z,shoulder,right,flexion,55
```

- Header required; columns exactly `timestamp, joint, side, movement, angleDeg` (any order). Unknown or duplicate columns are rejected (a column such as `angleRad` gets a "degrees required" hint).
- UTF-8, optional BOM, LF or CRLF, standard CSV quoting. Trailing blank lines are allowed; blank lines inside the data are errors.

## 3. JSON format

```json
{
  "format": "rheumatrack.movement.v1",
  "joint": "shoulder",
  "side": "right",
  "movement": "flexion",
  "unit": "deg",
  "source": "simulation",
  "description": "optional free text",
  "generator": { "optional": "metadata object" },
  "samples": [
    { "timestamp": "2026-10-26T10:00:00.000Z", "angleDeg": 20 },
    { "timestamp": "2026-10-26T10:00:00.100Z", "angleDeg": 35 }
  ]
}
```

`format` and `unit` must match exactly. Allowed top-level keys: those shown. Sample objects may contain only `timestamp` and `angleDeg`. `source` is informational: the user always confirms the data source when saving.

## 4. Validation (rejections are never repaired)

| Check | Rule | Message location |
|---|---|---|
| File type | `.csv` or `.json` | file |
| Size | ≤ 5 MB | file |
| Empty | non-empty, at least one data row | file |
| Columns / fields | as above | file / field |
| Missing values | every cell required | row + field |
| Timestamp | ISO 8601 **with timezone** (`Z` or `±HH:MM`), ≤ 3 fractional digits, real calendar date | row |
| Angle | plain decimal number (no units), finite, −180 … 180 | row |
| Joint/side/movement | known values; movement supported for the joint | row |
| Consistency | all rows same joint/side/movement | row |
| Sample count | 10 … 50 000 | file |
| Order | strictly ascending — out-of-order rows are reported, not sorted | row |
| Duplicates | identical timestamps reported with both row numbers | row |
| Sampling rate | median interval 1 … 1000 ms (1–1000 Hz) | file |
| Gaps | any interval > 5 × median → error (missing data) | row |
| Irregularity | interval deviating > 25 % from median is *irregular*; > 10 % irregular → error; otherwise accepted with a warning | file |

Row numbers count data rows (CSV header excluded; JSON = array index + 1). Up to 200 errors are listed; the total is reported.

## 5. Metrics (computed from every valid sample)

| Metric | Definition |
|---|---|
| Observed minimum / maximum | min / max of `angleDeg` |
| **Observed ROM** | **max − min** (never max alone). Not a clinically validated ROM assessment. |
| Mean angle | arithmetic mean of all samples (not time-weighted) |
| Duration | last − first timestamp (ms) |
| Interval statistics | min, max, mean, median, population SD of successive differences (ms); nominal rate = 1000 / median |
| Quality | number and % of irregular intervals (definition above) |
| Repetitions | hysteresis counter below, or *not counted* |

**Repetition algorithm** (`src/domain/repetitions.ts`):
1. `low = min + 0.30·ROM`, `high = min + 0.70·ROM`.
2. Angle ≤ low → state *below*; angle ≥ high → state *above*; values in between never change state (noise rejection).
3. One repetition = *below → above → below*. Counting starts after the signal has first been *below*; a final excursion that does not return is not counted.
4. Not counted when ROM < 5° (thresholds would sit inside noise).

These are signal-processing parameters, not clinical thresholds. The algorithm is tested in `src/domain/metrics.test.ts` and reproduced in MATLAB and Python.

**Reproducibility.** Metrics are pure functions of the stored samples. `src/domain/golden.test.ts` checks that the TypeScript results equal the independent Python reference within 1e-9 on four golden datasets; `matlab/rt_verify_golden.m` performs the same check in MATLAB. Stored values are full precision; rounding happens only on screen.

## 6. Exports

- **Sessions CSV** (`rheumatrack_sessions_*.csv`): `sessionId, joint, side, movement, dataSource, dataSourceLabel, synthetic, startedAt, endedAt, sampleCount, minDeg, maxDeg, observedRomDeg, meanDeg, durationMs, medianIntervalMs, samplingRateHz, irregularIntervals, repetitions, calibrationStatus, calibrationId, sourceFileName, notes`
- **Check-ins CSV**: `assessmentId, joint, side, assessedAt, pain, stiffness, discomfort, durationMinutes, synthetic, createdAt, updatedAt, notes`
- **JSON bundle** (`rheumatrack.export.v1`): the same rows plus `exportedAt`, the filters used and a provenance notice.
- **Raw samples** (per session): the import format above, so exports can be re-imported or analysed in MATLAB (round-trip tested).

Timestamps are exported as UTC ISO 8601 with milliseconds. Text cells beginning with `= + - @` are prefixed with `'` to prevent spreadsheet formula injection; numeric values are unchanged.

## 7. Storage

Validated samples are stored in chunks of up to 5000 (`t` epoch-ms, `a` degrees) under the session. Metrics are computed once at import and stored with the session.

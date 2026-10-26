#!/usr/bin/env python3
"""
RheumaTrack reference analysis — independent Python implementation (standard library only).

It implements the same documented definitions as src/domain/metrics.ts and
matlab/rt_analyse_session.m so the three can be cross-checked on identical input:

  observed ROM          = max(angle) - min(angle)
  mean angle            = arithmetic mean of all samples
  duration              = t_last - t_first (ms)
  interval statistics   = min / max / mean / median / population SD of successive differences (ms)
  sampling rate         = 1000 / median interval (Hz)
  irregular intervals   = |dt - median| > 0.25 * median
  repetitions           = hysteresis counter, thresholds at 30 % and 70 % of ROM above min,
                          one repetition = below -> above -> below, counting starts after the
                          signal has first been below; not counted (None) when ROM < 5 deg.

Usage:
  python3 rt_analysis.py file.csv [file2.csv ...]          print metrics as JSON
  python3 rt_analysis.py --write-expected <golden_dir>    write expected.json for all *.csv
"""
from __future__ import annotations

import csv
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

IRREGULAR_TOLERANCE = 0.25
REP_LOW = 0.3
REP_HIGH = 0.7
REP_MIN_ROM = 5.0


def parse_ts(value: str) -> int:
    """ISO-8601 with timezone -> epoch milliseconds (integer)."""
    v = value.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(v)
    if dt.tzinfo is None:
        raise ValueError(f"timestamp without timezone: {value}")
    # Integer arithmetic avoids float rounding of milliseconds.
    delta = dt - datetime(1970, 1, 1, tzinfo=timezone.utc)
    return delta.days * 86_400_000 + delta.seconds * 1000 + delta.microseconds // 1000


def read_csv(path: Path) -> tuple[list[int], list[float]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        t: list[int] = []
        a: list[float] = []
        for row in reader:
            t.append(parse_ts(row["timestamp"]))
            a.append(float(row["angleDeg"]))
    return t, a


def median(values: list[float]) -> float:
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return float(s[mid]) if n % 2 else (s[mid - 1] + s[mid]) / 2


def mean(values: list[float]) -> float:
    total = 0.0
    for v in values:  # sequential summation, same order as the TypeScript implementation
        total += v
    return total / len(values)


def pop_sd(values: list[float]) -> float:
    m = mean(values)
    acc = 0.0
    for v in values:
        acc += (v - m) ** 2
    return math.sqrt(acc / len(values))


def count_reps(angles: list[float]) -> int | None:
    if len(angles) < 3:
        return None
    lo, hi = min(angles), max(angles)
    rom = hi - lo
    if rom < REP_MIN_ROM:
        return None
    low = lo + REP_LOW * rom
    high = lo + REP_HIGH * rom
    state = "unknown"
    seen_below = False
    count = 0
    for a in angles:
        if a <= low:
            if state == "above" and seen_below:
                count += 1
            state = "below"
            seen_below = True
        elif a >= high:
            state = "above"
    return count


def analyse(t: list[int], a: list[float]) -> dict:
    intervals = [float(t[i] - t[i - 1]) for i in range(1, len(t))]
    med = median(intervals)
    irregular = sum(1 for dt in intervals if abs(dt - med) > IRREGULAR_TOLERANCE * med)
    return {
        "sampleCount": len(a),
        "minDeg": min(a),
        "maxDeg": max(a),
        "romDeg": max(a) - min(a),
        "meanDeg": mean(a),
        "durationMs": t[-1] - t[0],
        "interval": {
            "min": min(intervals),
            "max": max(intervals),
            "mean": mean(intervals),
            "median": med,
            "sd": pop_sd(intervals),
            "rateHz": 1000.0 / med if med > 0 else 0.0,
        },
        "irregularIntervals": irregular,
        "repetitions": count_reps(a),
    }


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "--write-expected":
        folder = Path(argv[1])
        expected = {}
        for f in sorted(folder.glob("*.csv")):
            t, a = read_csv(f)
            expected[f.name] = analyse(t, a)
        (folder / "expected.json").write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {folder / 'expected.json'} ({len(expected)} files)")
        return 0
    if not argv:
        print(__doc__)
        return 1
    result = {}
    for name in argv:
        t, a = read_csv(Path(name))
        result[Path(name).name] = analyse(t, a)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

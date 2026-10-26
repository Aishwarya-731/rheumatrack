import { describe, expect, it } from 'vitest';
import { computeMetrics } from './metrics';
import { validateMovementFile } from './validation';

/**
 * Cross-implementation check: the TypeScript engine must reproduce the metrics that the
 * independent Python reference (reference/python/rt_analysis.py) wrote to expected.json for
 * the same golden CSV files. matlab/rt_verify_golden.m performs the same check in MATLAB.
 */
const files = import.meta.glob('../../reference/golden/*.csv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const expectedAll = import.meta.glob('../../reference/golden/expected.json', { import: 'default', eager: true }) as Record<string, Record<string, ExpectedMetrics>>;
const expected = Object.values(expectedAll)[0] ?? {};

interface ExpectedMetrics {
  sampleCount: number;
  minDeg: number;
  maxDeg: number;
  romDeg: number;
  meanDeg: number;
  durationMs: number;
  interval: { min: number; max: number; mean: number; median: number; sd: number; rateHz: number };
  irregularIntervals: number;
  repetitions: number | null;
}

const TOL = 1e-9;

describe('golden datasets: TypeScript vs Python reference', () => {
  const entries = Object.entries(files);

  it('has golden files and expected values', () => {
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(expected).length).toBe(entries.length);
  });

  for (const [path, text] of entries) {
    const name = path.split('/').pop() as string;
    it(name, () => {
      const res = validateMovementFile(name, text, text.length);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const m = computeMetrics(res.recording.samples);
      const e = expected[name];
      expect(e).toBeDefined();
      if (!e) return;
      expect(m.sampleCount).toBe(e.sampleCount);
      expect(m.durationMs).toBe(e.durationMs);
      expect(m.repetitions).toBe(e.repetitions);
      expect(m.quality.irregularIntervals).toBe(e.irregularIntervals);
      for (const [k, v] of [
        ['minDeg', e.minDeg],
        ['maxDeg', e.maxDeg],
        ['romDeg', e.romDeg],
        ['meanDeg', e.meanDeg],
      ] as const) {
        expect(Math.abs(m[k] - v), k).toBeLessThanOrEqual(TOL);
      }
      for (const k of ['min', 'max', 'mean', 'median', 'sd', 'rateHz'] as const) {
        expect(Math.abs(m.interval[k] - e.interval[k]), `interval.${k}`).toBeLessThanOrEqual(TOL);
      }
    });
  }
});

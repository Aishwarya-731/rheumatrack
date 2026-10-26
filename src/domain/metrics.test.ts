import { describe, expect, it } from 'vitest';
import { computeMetrics, mean, median, populationSd } from './metrics';
import { countRepetitions } from './repetitions';
import type { AngleSample } from './types';

function samples(angles: number[], stepMs = 100, start = 1_000_000): AngleSample[] {
  return angles.map((a, i) => ({ t: start + i * stepMs, angleDeg: a }));
}

describe('basic statistics', () => {
  it('median handles odd and even lengths without mutating input', () => {
    const v = [5, 1, 3];
    expect(median(v)).toBe(3);
    expect(v).toEqual([5, 1, 3]);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow();
  });

  it('mean and population SD', () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    expect(populationSd([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});

describe('computeMetrics', () => {
  it('ROM is max − min, not max alone (negative and positive angles)', () => {
    const m = computeMetrics(samples([-10, 0, 25, 40, 15, -5, 0, 10, 30, 20]));
    expect(m.minDeg).toBe(-10);
    expect(m.maxDeg).toBe(40);
    expect(m.romDeg).toBe(50);
  });

  it('ROM when all angles are positive is still max − min', () => {
    const m = computeMetrics(samples([20, 35, 55, 70, 90, 60, 40, 30, 25, 22]));
    expect(m.romDeg).toBe(70);
    expect(m.romDeg).not.toBe(m.maxDeg);
  });

  it('mean angle is the arithmetic mean of all samples', () => {
    const m = computeMetrics(samples([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(m.meanDeg).toBe(5.5);
  });

  it('duration and interval statistics', () => {
    const m = computeMetrics(samples([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 20));
    expect(m.durationMs).toBe(180);
    expect(m.interval.median).toBe(20);
    expect(m.interval.min).toBe(20);
    expect(m.interval.max).toBe(20);
    expect(m.interval.sd).toBe(0);
    expect(m.interval.rateHz).toBe(50);
    expect(m.quality.irregularIntervals).toBe(0);
  });

  it('counts irregular intervals as a quality indicator', () => {
    const s: AngleSample[] = [0, 100, 200, 340, 440, 540, 640, 740, 840, 940].map((t, i) => ({ t, angleDeg: i }));
    const m = computeMetrics(s);
    expect(m.quality.irregularIntervals).toBe(1);
    expect(m.quality.irregularIntervalPct).toBeCloseTo((1 / 9) * 100, 10);
  });

  it('is deterministic for identical input', () => {
    const s = samples([3, 9, 27, 81, 27, 9, 3, 9, 27, 81]);
    expect(computeMetrics(s)).toEqual(computeMetrics(s.map((x) => ({ ...x }))));
  });

  it('requires at least two samples', () => {
    expect(() => computeMetrics(samples([1]))).toThrow();
  });
});

describe('countRepetitions (hysteresis)', () => {
  const cycle = [0, 25, 50, 75, 100, 75, 50, 25];

  it('counts full low → high → low cycles', () => {
    const angles = [...cycle, ...cycle, ...cycle, 0];
    expect(countRepetitions(angles).count).toBe(3);
  });

  it('does not count a final excursion that never returns low', () => {
    const angles = [...cycle, ...cycle, 0, 50, 100];
    expect(countRepetitions(angles).count).toBe(2);
  });

  it('does not count a recording that starts high until it has been low', () => {
    const angles = [100, 60, 0, 50, 100, 50, 0];
    expect(countRepetitions(angles).count).toBe(1);
  });

  it('ignores noise around a single threshold (hysteresis)', () => {
    // Oscillates between 45 and 55 (within the 30–70 band) — never a full cycle.
    const angles = [0, 45, 55, 45, 55, 45, 55, 100, 0];
    expect(countRepetitions(angles).count).toBe(1);
  });

  it('returns null when ROM is too small to count reliably', () => {
    const r = countRepetitions([10, 11, 12, 11, 10, 11, 12]);
    expect(r.count).toBeNull();
    expect(r.note).toMatch(/below 5°/);
  });

  it('exposes the thresholds used', () => {
    const r = countRepetitions([0, 100, 0]);
    expect(r.lowThresholdDeg).toBe(30);
    expect(r.highThresholdDeg).toBe(70);
  });
});

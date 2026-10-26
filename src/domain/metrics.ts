import { ANALYSIS_CONFIG } from './analysisConfig';
import { countRepetitions } from './repetitions';
import type { AngleSample, IntervalStats, MovementMetrics, QualityIndicators } from './types';

/** Median of a non-empty numeric array (does not mutate the input). */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median() requires at least one value');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('mean() requires at least one value');
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Population standard deviation (divides by N), matching MATLAB std(x, 1) and numpy std(). */
export function populationSd(values: readonly number[]): number {
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return Math.sqrt(acc / values.length);
}

/** Successive differences of the timestamps, in ms. Requires ≥ 2 samples. */
export function intervalsOf(samples: readonly AngleSample[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    out.push((samples[i] as AngleSample).t - (samples[i - 1] as AngleSample).t);
  }
  return out;
}

export function intervalStats(intervals: readonly number[]): IntervalStats {
  const med = median(intervals);
  let lo = Infinity;
  let hi = -Infinity;
  for (const dt of intervals) {
    if (dt < lo) lo = dt;
    if (dt > hi) hi = dt;
  }
  return {
    min: lo,
    max: hi,
    mean: mean(intervals),
    median: med,
    sd: populationSd(intervals),
    rateHz: med > 0 ? 1000 / med : 0,
  };
}

export function qualityIndicators(intervals: readonly number[], medianInterval: number): QualityIndicators {
  const tol = ANALYSIS_CONFIG.irregularTolerance * medianInterval;
  let irregular = 0;
  for (const dt of intervals) if (Math.abs(dt - medianInterval) > tol) irregular++;
  return {
    irregularIntervals: irregular,
    irregularIntervalPct: intervals.length > 0 ? (irregular / intervals.length) * 100 : 0,
  };
}

/**
 * Compute every supported metric from already-validated samples (sorted, unique timestamps,
 * at least ANALYSIS_CONFIG.minSamples). Pure and deterministic: the same samples always give
 * the same result, which is what the MATLAB/Python cross-checks rely on.
 */
export function computeMetrics(samples: readonly AngleSample[]): MovementMetrics {
  if (samples.length < 2) throw new Error('computeMetrics() requires at least two samples');
  const angles = samples.map((s) => s.angleDeg);
  let minDeg = Infinity;
  let maxDeg = -Infinity;
  for (const a of angles) {
    if (a < minDeg) minDeg = a;
    if (a > maxDeg) maxDeg = a;
  }
  const intervals = intervalsOf(samples);
  const interval = intervalStats(intervals);
  const reps = countRepetitions(angles);
  const first = samples[0] as AngleSample;
  const last = samples[samples.length - 1] as AngleSample;
  return {
    sampleCount: samples.length,
    minDeg,
    maxDeg,
    romDeg: maxDeg - minDeg,
    meanDeg: mean(angles),
    durationMs: last.t - first.t,
    interval,
    quality: qualityIndicators(intervals, interval.median),
    repetitions: reps.count,
    repetitionNote: reps.note,
  };
}

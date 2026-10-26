/**
 * Algorithm parameters for import validation and movement analysis.
 *
 * These are data-quality and signal-processing parameters. None of them is a clinical
 * threshold. They are documented in docs/DATA_CONTRACT.md and mirrored exactly in the
 * MATLAB (matlab/rt_config.m) and Python (reference/python/rt_analysis.py) implementations.
 */
export const ANALYSIS_CONFIG = {
  /** Largest accepted upload. */
  maxFileBytes: 5 * 1024 * 1024,
  /** Most samples accepted in one session. */
  maxSamples: 50_000,
  /** Fewest samples needed to analyse a session. */
  minSamples: 10,
  /** Physically meaningful bound for a joint angle in degrees. */
  minAngleDeg: -180,
  maxAngleDeg: 180,
  /** Accepted nominal sampling rate window, expressed as median interval (ms). */
  minMedianIntervalMs: 1, // 1000 Hz
  maxMedianIntervalMs: 1000, // 1 Hz
  /** An interval deviating more than this fraction from the median is "irregular". */
  irregularTolerance: 0.25,
  /** Reject when more than this fraction of intervals is irregular. */
  maxIrregularFraction: 0.1,
  /** Reject when any single interval exceeds this multiple of the median (data gap). */
  maxGapMultiple: 5,
  /** Repetition counting: hysteresis thresholds as fractions of observed ROM above min. */
  repLowFraction: 0.3,
  repHighFraction: 0.7,
  /** Repetition counting is not attempted when observed ROM is below this (degrees). */
  repMinRomDeg: 5,
} as const;

export const CALIBRATION_CONFIG = {
  /** A static hold must not vary more than this (standard deviation, degrees). */
  maxHoldSdDeg: 2,
  /** A static hold must last at least this long (ms). */
  minHoldDurationMs: 2000,
  minSamples: 20,
} as const;

export const ASSOCIATION_CONFIG = {
  /** Assessments and sessions are paired when their timestamps differ by at most this. */
  pairingWindowMs: 2 * 60 * 60 * 1000,
  /** Fewest paired observations before any association value is shown. */
  minPairs: 10,
} as const;

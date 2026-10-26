import { ANALYSIS_CONFIG } from './analysisConfig';

export interface RepetitionResult {
  count: number | null;
  /** Why counting was not attempted, or null when a count is available. */
  note: string | null;
  lowThresholdDeg: number | null;
  highThresholdDeg: number | null;
}

/**
 * Hysteresis repetition counter (documented in docs/DATA_CONTRACT.md §5).
 *
 * 1. low  = min + repLowFraction  × ROM,  high = min + repHighFraction × ROM
 * 2. The signal is "below" when angle ≤ low and "above" when angle ≥ high; values between
 *    the thresholds never change state, which suppresses noise around a single threshold.
 * 3. One repetition = a transition below → above → below. Counting starts only after the
 *    signal has first been below, so a recording that starts mid-movement is not
 *    over-counted. A final excursion above that never returns below is not counted.
 *
 * Counting is skipped (count = null) when observed ROM < repMinRomDeg, because the
 * thresholds would then sit inside the noise.
 */
export function countRepetitions(angles: readonly number[]): RepetitionResult {
  if (angles.length < 3) {
    return { count: null, note: 'Too few samples to count repetitions.', lowThresholdDeg: null, highThresholdDeg: null };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const a of angles) {
    if (a < min) min = a;
    if (a > max) max = a;
  }
  const rom = max - min;
  if (rom < ANALYSIS_CONFIG.repMinRomDeg) {
    return {
      count: null,
      note: `Observed ROM below ${ANALYSIS_CONFIG.repMinRomDeg}°; repetitions are not counted.`,
      lowThresholdDeg: null,
      highThresholdDeg: null,
    };
  }
  const low = min + ANALYSIS_CONFIG.repLowFraction * rom;
  const high = min + ANALYSIS_CONFIG.repHighFraction * rom;

  type State = 'unknown' | 'below' | 'above';
  let state: State = 'unknown';
  let seenBelow = false;
  let count = 0;
  for (const a of angles) {
    if (a <= low) {
      if (state === 'above' && seenBelow) count++;
      state = 'below';
      seenBelow = true;
    } else if (a >= high) {
      state = 'above';
    }
  }
  return { count, note: null, lowThresholdDeg: low, highThresholdDeg: high };
}

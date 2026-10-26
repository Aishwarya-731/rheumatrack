import { CALIBRATION_CONFIG } from './analysisConfig';
import { mean, populationSd } from './metrics';
import type { AngleSample } from './types';

/**
 * Static-reference calibration (docs/CALIBRATION.md).
 *
 * No sensor hardware is connected, so a sensor calibration cannot be performed. What can be
 * performed is a *static reference* check: the user records the joint held still in a
 * neutral position (e.g. via MATLAB or another tool) and imports that file. The hold must be
 * long enough and still enough; if so, its mean angle is stored as a zero-reference with full
 * metadata. Imported movement sessions are never altered by it and are never marked as
 * "calibrated sensor data".
 */
export type CalibrationStep = 'select' | 'instructions' | 'capture' | 'validate' | 'result';

export interface StaticHoldEvaluation {
  passed: boolean;
  referenceAngleDeg: number;
  holdSdDeg: number;
  holdDurationMs: number;
  sampleCount: number;
  messages: string[];
}

export function evaluateStaticHold(samples: readonly AngleSample[]): StaticHoldEvaluation {
  const messages: string[] = [];
  const angles = samples.map((s) => s.angleDeg);
  const n = samples.length;
  const duration = n >= 2 ? (samples[n - 1] as AngleSample).t - (samples[0] as AngleSample).t : 0;
  const sd = n > 0 ? populationSd(angles) : Infinity;
  const ref = n > 0 ? mean(angles) : NaN;
  let passed = true;
  if (n < CALIBRATION_CONFIG.minSamples) {
    passed = false;
    messages.push(`Needs at least ${CALIBRATION_CONFIG.minSamples} samples; found ${n}.`);
  } else messages.push(`Sample count ${n} — OK.`);
  if (duration < CALIBRATION_CONFIG.minHoldDurationMs) {
    passed = false;
    messages.push(`Hold lasted ${(duration / 1000).toFixed(2)} s; at least ${CALIBRATION_CONFIG.minHoldDurationMs / 1000} s is required.`);
  } else messages.push(`Hold duration ${(duration / 1000).toFixed(2)} s — OK.`);
  if (!(sd <= CALIBRATION_CONFIG.maxHoldSdDeg)) {
    passed = false;
    messages.push(`Angle varied too much during the hold (SD ${sd.toFixed(2)}°; limit ${CALIBRATION_CONFIG.maxHoldSdDeg}°). Keep the joint still and record again.`);
  } else messages.push(`Stillness SD ${sd.toFixed(2)}° — OK.`);
  return { passed, referenceAngleDeg: ref, holdSdDeg: sd, holdDurationMs: duration, sampleCount: n, messages };
}

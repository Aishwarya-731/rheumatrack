/**
 * Writes SYNTHETIC sample datasets to matlab/samples/ using the same model as
 * matlab/rt_generate_synthetic.m (the TypeScript port in src/domain/synthetic.ts).
 * Also writes deliberately invalid files for demonstrating import rejection.
 *
 * Run: npx tsx scripts/generate-samples.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { samplesToCsv, samplesToJson } from '../src/domain/export';
import type { Joint, Movement, Side } from '../src/domain/joints';
import { generateSynthetic } from '../src/domain/synthetic';
import { JSON_FORMAT_ID } from '../src/domain/validation';

const dir = join(process.cwd(), 'matlab', 'samples');
mkdirSync(dir, { recursive: true });
const start = Date.UTC(2026, 9, 26, 4, 30, 0);

const specs: Array<[Joint, Side, Movement, number, number, number, number, number, number, number]> = [
  ['shoulder', 'right', 'flexion', 50, 20, 5, 140, 5, 1.0, 11],
  ['shoulder', 'left', 'abduction', 50, 20, 5, 130, 5, 1.0, 12],
  ['elbow', 'right', 'flexion', 50, 16, 3, 120, 4, 0.8, 13],
  ['wrist', 'left', 'extension', 50, 12, 0, 55, 3, 0.6, 14],
  ['hip', 'right', 'flexion', 50, 20, 2, 95, 5, 1.0, 15],
  ['knee', 'left', 'flexion', 50, 20, 4, 115, 4, 1.2, 16],
  ['knee', 'right', 'flexion', 50, 20, 4, 120, 4, 1.2, 17],
  ['ankle', 'right', 'dorsiflexion', 50, 12, 0, 18, 3, 0.5, 18],
];

for (const [joint, side, movement, rate, dur, base, amp, period, noise, seed] of specs) {
  const samples = generateSynthetic({ joint, side, movement, startMs: start, sampleRateHz: rate, durationS: dur, baseDeg: base, amplitudeDeg: amp, periodS: period, noiseSdDeg: noise, seed });
  const name = `synthetic_${joint}_${side}_${movement}`;
  writeFileSync(join(dir, `${name}.csv`), samplesToCsv({ joint, side, movement }, samples));
  const json = JSON.parse(samplesToJson({ joint, side, movement, source: 'simulation' }, samples)) as Record<string, unknown>;
  json.description = 'SYNTHETIC data — simulation-generated, not a measurement of any person.';
  json.generator = { tool: 'RheumaTrack synthetic model (TypeScript port of rt_generate_synthetic.m)', sampleRateHz: rate, durationS: dur, baseDeg: base, amplitudeDeg: amp, periodS: period, noiseSdDeg: noise, seed };
  writeFileSync(join(dir, `${name}.json`), JSON.stringify({ format: JSON_FORMAT_ID, ...json }, null, 2) + '\n');
  console.log(`wrote ${name}.csv/.json (${samples.length} samples)`);
}

// Static hold for the calibration workflow (still, ~3 s).
{
  const s = generateSynthetic({ joint: 'knee', side: 'right', movement: 'flexion', startMs: start, sampleRateHz: 50, durationS: 3, baseDeg: 2, amplitudeDeg: 0, periodS: 1, noiseSdDeg: 0.4, seed: 99 });
  writeFileSync(join(dir, 'synthetic_static_hold_knee_right.csv'), samplesToCsv({ joint: 'knee', side: 'right', movement: 'flexion' }, s));
}

// Seven daily sessions for the Trends page (mirrors matlab/rt_make_trend_dataset.m).
{
  const trendDir = join(dir, 'trend');
  mkdirSync(trendDir, { recursive: true });
  const amplitudes = [92, 96, 101, 99, 106, 110, 113];
  const day0 = Date.UTC(2026, 9, 20, 3, 30, 0); // 09:00 IST
  amplitudes.forEach((amp, i) => {
    const s = generateSynthetic({ joint: 'knee', side: 'right', movement: 'flexion', startMs: day0 + i * 86_400_000, sampleRateHz: 50, durationS: 16, baseDeg: 4, amplitudeDeg: amp, periodS: 4, noiseSdDeg: 1.0, seed: 101 + i });
    writeFileSync(join(trendDir, `synthetic_knee_right_flexion_day${i + 1}.csv`), samplesToCsv({ joint: 'knee', side: 'right', movement: 'flexion' }, s));
  });
  console.log('wrote trend/day1..day7');
}

// Invalid examples — each should be rejected by the importer with row-level messages.
const ok = generateSynthetic({ joint: 'knee', side: 'left', movement: 'flexion', startMs: start, sampleRateHz: 10, durationS: 2, baseDeg: 0, amplitudeDeg: 90, periodS: 2, noiseSdDeg: 0, seed: 1 });
const lines = samplesToCsv({ joint: 'knee', side: 'left', movement: 'flexion' }, ok).trim().split('\n');
const dup = [...lines];
dup[5] = dup[4] as string;
writeFileSync(join(dir, 'invalid_duplicate_timestamp.csv'), dup.join('\n') + '\n');
const bad = [...lines];
bad[3] = (bad[3] as string).replace(/,[^,]*$/, ',twenty');
bad[7] = (bad[7] as string).replace('knee', 'kneee');
writeFileSync(join(dir, 'invalid_values.csv'), bad.join('\n') + '\n');
writeFileSync(join(dir, 'invalid_missing_column.csv'), lines.map((l) => l.split(',').slice(0, 4).join(',')).join('\n') + '\n');
writeFileSync(join(dir, 'invalid_unsupported_movement.csv'), lines.map((l, i) => (i === 0 ? l : l.replace('flexion', 'abduction'))).join('\n') + '\n');
console.log('wrote invalid_*.csv examples');

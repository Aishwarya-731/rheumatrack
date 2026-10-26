/**
 * Generates the golden input fixtures in reference/golden/.
 * Inputs only — expected metrics are produced independently by the Python reference
 * (reference/python/rt_analysis.py) and checked by the TypeScript tests and MATLAB.
 *
 * Run: npx tsx scripts/generate-golden.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateSynthetic } from '../src/domain/synthetic';
import { samplesToCsv } from '../src/domain/export';
import type { AngleSample } from '../src/domain/types';
import type { Joint, Movement, Side } from '../src/domain/joints';

const out = join(process.cwd(), 'reference', 'golden');
mkdirSync(out, { recursive: true });
const start = Date.UTC(2026, 9, 26, 10, 0, 0);

const cases: Array<{ name: string; joint: Joint; side: Side; movement: Movement; samples: AngleSample[] }> = [];

cases.push({
  name: 'golden_knee_right_flexion',
  joint: 'knee',
  side: 'right',
  movement: 'flexion',
  samples: generateSynthetic({ joint: 'knee', side: 'right', movement: 'flexion', startMs: start, sampleRateHz: 50, durationS: 20, baseDeg: 5, amplitudeDeg: 110, periodS: 4, noiseSdDeg: 1.5, seed: 101 }),
});

cases.push({
  name: 'golden_shoulder_left_abduction',
  joint: 'shoulder',
  side: 'left',
  movement: 'abduction',
  samples: generateSynthetic({ joint: 'shoulder', side: 'left', movement: 'abduction', startMs: start, sampleRateHz: 100, durationS: 15, baseDeg: 10, amplitudeDeg: 140, periodS: 5, noiseSdDeg: 0.8, seed: 202 }),
});

// Negative angles (plantarflexion recorded as negative), starts at peak, slightly irregular timing.
{
  const s: AngleSample[] = [];
  let t = start;
  for (let i = 0; i < 400; i++) {
    t += i % 37 === 0 && i > 0 ? 26 : 20; // a few intervals 30% long → quality indicator, still accepted
    const angle = -40 * Math.cos((2 * Math.PI * i) / 100) + (i % 7) * 0.1;
    s.push({ t, angleDeg: Math.round(angle * 1000) / 1000 });
  }
  cases.push({ name: 'golden_ankle_left_plantarflexion', joint: 'ankle', side: 'left', movement: 'plantarflexion', samples: s });
}

// Small-ROM recording: repetitions must not be counted.
{
  const s: AngleSample[] = Array.from({ length: 50 }, (_, i) => ({ t: start + i * 100, angleDeg: 30 + 1.5 * Math.sin(i / 3) }));
  cases.push({ name: 'golden_elbow_right_small_rom', joint: 'elbow', side: 'right', movement: 'flexion', samples: s.map((x) => ({ ...x, angleDeg: Math.round(x.angleDeg * 1e6) / 1e6 })) });
}

for (const c of cases) {
  writeFileSync(join(out, `${c.name}.csv`), samplesToCsv({ joint: c.joint, side: c.side, movement: c.movement }, c.samples));
  console.log(`wrote ${c.name}.csv (${c.samples.length} samples)`);
}

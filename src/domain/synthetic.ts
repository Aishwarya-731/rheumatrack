import { getMovement, type Joint, type Movement, type Side } from './joints';
import type { AngleSample } from './types';

/**
 * Synthetic movement generator — same model as matlab/generate_synthetic.m.
 *
 *   angle(t) = baseDeg + amplitudeDeg · (1 − cos(2π · t / periodS)) / 2 + noise(t)
 *
 * noise is Gaussian with standard deviation noiseSdDeg from a seeded generator, so a given
 * seed always yields identical data. Output is SYNTHETIC: it is not a measurement of anyone.
 */
export interface SyntheticConfig {
  joint: Joint;
  side: Side;
  movement: Movement;
  startMs: number;
  sampleRateHz: number;
  durationS: number;
  baseDeg: number;
  amplitudeDeg: number;
  periodS: number;
  noiseSdDeg: number;
  seed: number;
}

/** mulberry32: small deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function generateSynthetic(cfg: SyntheticConfig): AngleSample[] {
  const rand = mulberry32(cfg.seed);
  const intervalMs = Math.round(1000 / cfg.sampleRateHz);
  const n = Math.floor((cfg.durationS * 1000) / intervalMs) + 1;
  const out: AngleSample[] = [];
  for (let i = 0; i < n; i++) {
    const tS = (i * intervalMs) / 1000;
    const clean = cfg.baseDeg + (cfg.amplitudeDeg * (1 - Math.cos((2 * Math.PI * tS) / cfg.periodS))) / 2;
    const noisy = clean + cfg.noiseSdDeg * gaussian(rand);
    const angle = Math.round(Math.max(-180, Math.min(180, noisy)) * 100) / 100;
    out.push({ t: cfg.startMs + i * intervalMs, angleDeg: angle });
  }
  return out;
}

/** Reasonable defaults for a joint/movement, using the illustrative animation sweep. */
export function defaultSyntheticConfig(joint: Joint, side: Side, movement: Movement, startMs: number, seed: number): SyntheticConfig {
  const def = getMovement(joint, movement);
  const sweep = def ? Math.abs(def.animation.to - def.animation.from) : 60;
  return {
    joint,
    side,
    movement,
    startMs,
    sampleRateHz: 50,
    durationS: 20,
    baseDeg: 5,
    amplitudeDeg: Math.max(10, sweep * 0.8),
    periodS: 4,
    noiseSdDeg: 1,
    seed,
  };
}

import { ASSOCIATION_CONFIG } from './analysisConfig';
import type { Joint, Movement, Side } from './joints';
import type { MovementSession, SymptomAssessment } from './types';

/**
 * Symptom ↔ movement association (docs/ANALYTICS.md).
 *
 * Pairing: for one joint + side (+ optionally one movement), every assessment is paired with
 * the session whose start time is closest, provided the difference is within
 * ASSOCIATION_CONFIG.pairingWindowMs. Pairs are formed greedily by smallest time difference
 * and each session and each assessment is used at most once.
 *
 * Statistic: Spearman rank correlation (ties receive average ranks), chosen because symptom
 * scores are ordinal 0–10 ratings and no linear relationship or normality is assumed.
 * Two-sided p-value from the t approximation t = r·√((n−2)/(1−r²)) with n−2 df.
 *
 * Nothing is computed when there are fewer than ASSOCIATION_CONFIG.minPairs pairs or either
 * variable is constant. Association is not causation.
 */

export type SymptomMetric = 'pain' | 'stiffness' | 'discomfort';

export interface PairedObservation {
  sessionId: string;
  assessmentId: string;
  sessionTime: number;
  assessmentTime: number;
  romDeg: number;
  symptom: number;
}

export function pairObservations(
  sessions: readonly MovementSession[],
  assessments: readonly SymptomAssessment[],
  joint: Joint,
  side: Side,
  movement: Movement | null,
  metric: SymptomMetric,
  windowMs: number = ASSOCIATION_CONFIG.pairingWindowMs,
): PairedObservation[] {
  const ss = sessions.filter((s) => s.joint === joint && s.side === side && (movement === null || s.movement === movement));
  const as = assessments.filter((a) => a.joint === joint && a.side === side);
  const candidates: Array<{ s: MovementSession; a: SymptomAssessment; diff: number }> = [];
  for (const a of as) {
    for (const s of ss) {
      const diff = Math.abs(s.startedAt - a.assessedAt);
      if (diff <= windowMs) candidates.push({ s, a, diff });
    }
  }
  // Deterministic order: smallest difference, then earliest assessment, then ids.
  candidates.sort(
    (x, y) => x.diff - y.diff || x.a.assessedAt - y.a.assessedAt || x.a.id.localeCompare(y.a.id) || x.s.id.localeCompare(y.s.id),
  );
  const usedS = new Set<string>();
  const usedA = new Set<string>();
  const pairs: PairedObservation[] = [];
  for (const { s, a } of candidates) {
    if (usedS.has(s.id) || usedA.has(a.id)) continue;
    usedS.add(s.id);
    usedA.add(a.id);
    pairs.push({
      sessionId: s.id,
      assessmentId: a.id,
      sessionTime: s.startedAt,
      assessmentTime: a.assessedAt,
      romDeg: s.metrics.romDeg,
      symptom: a[metric],
    });
  }
  return pairs.sort((x, y) => x.assessmentTime - y.assessmentTime);
}

/** Average ranks (1-based); ties share the mean of the ranks they span. */
export function averageRanks(values: readonly number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length).fill(0);
  let k = 0;
  while (k < order.length) {
    let j = k;
    while (j + 1 < order.length && (order[j + 1] as { v: number }).v === (order[k] as { v: number }).v) j++;
    const avg = (k + j) / 2 + 1;
    for (let m = k; m <= j; m++) ranks[(order[m] as { i: number }).i] = avg;
    k = j + 1;
  }
  return ranks;
}

export function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = x.length;
  if (n !== y.length || n < 2) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i] as number;
    my += y[i] as number;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (x[i] as number) - mx;
    const dy = (y[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function spearman(x: readonly number[], y: readonly number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  return pearson(averageRanks(x), averageRanks(y));
}

export type AssociationResult =
  | { status: 'insufficient'; n: number; reason: string }
  | { status: 'ok'; n: number; rho: number; pValue: number; method: 'spearman' };

export function associate(pairs: readonly PairedObservation[], minPairs: number = ASSOCIATION_CONFIG.minPairs): AssociationResult {
  const n = pairs.length;
  if (n < minPairs) {
    return { status: 'insufficient', n, reason: `At least ${minPairs} paired observations are needed; ${n} available.` };
  }
  const x = pairs.map((p) => p.romDeg);
  const y = pairs.map((p) => p.symptom);
  const rho = spearman(x, y);
  if (rho === null) {
    return { status: 'insufficient', n, reason: 'One of the variables does not vary across the paired observations, so no correlation can be computed.' };
  }
  return { status: 'ok', n, rho, pValue: spearmanPValue(rho, n), method: 'spearman' };
}

/** Two-sided p-value via the Student-t approximation. */
export function spearmanPValue(rho: number, n: number): number {
  if (n <= 2) return 1;
  if (Math.abs(rho) >= 1) return 0;
  const df = n - 2;
  const t = rho * Math.sqrt(df / (1 - rho * rho));
  return studentTTwoSided(t, df);
}

/** Two-sided tail probability P(|T| ≥ |t|) for Student's t with `df` degrees of freedom. */
export function studentTTwoSided(t: number, df: number): number {
  const x = df / (df + t * t);
  return regularizedIncompleteBeta(x, df / 2, 0.5);
}

function logGamma(z: number): number {
  // Lanczos approximation (g = 7, n = 9).
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let a = c[0] as number;
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += (c[i] as number) / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularized incomplete beta I_x(a, b) via Lentz's continued fraction (Numerical Recipes). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b + lbeta);
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const MAX_ITER = 300;
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function describeStrength(rho: number): string {
  const r = Math.abs(rho);
  // Conventional descriptive labels for the size of a correlation coefficient (statistical,
  // not clinical). They describe the coefficient only.
  if (r < 0.1) return 'negligible';
  if (r < 0.3) return 'weak';
  if (r < 0.5) return 'moderate';
  return 'strong';
}

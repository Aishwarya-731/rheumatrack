import { describe, expect, it } from 'vitest';
import { associate, averageRanks, pairObservations, regularizedIncompleteBeta, spearman, spearmanPValue, studentTTwoSided } from './correlation';
import { makeAssessment, makeSession } from '@/test/factories';

describe('ranks and Spearman', () => {
  it('assigns average ranks to ties', () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });

  it('perfect monotonic relationships give ±1', () => {
    expect(spearman([1, 2, 3, 4, 5], [2, 4, 8, 16, 32])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 12);
  });

  it('matches a hand-computed value', () => {
    // Classic example: d² sum = 4 for n = 5 → rho = 1 − 6·4/(5·24) = 0.8
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8, 12);
  });

  it('returns null when a variable is constant', () => {
    expect(spearman([1, 2, 3], [4, 4, 4])).toBeNull();
  });
});

describe('p-values', () => {
  it('incomplete beta known values', () => {
    expect(regularizedIncompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 12);
    expect(regularizedIncompleteBeta(0.2, 1, 1)).toBeCloseTo(0.2, 12);
  });

  it('Student t two-sided tail matches reference tables', () => {
    // t = 2.228, df = 10 → two-sided p ≈ 0.05
    expect(studentTTwoSided(2.228, 10)).toBeCloseTo(0.05, 3);
    // t = 2.0, df = 20 → p ≈ 0.0593
    expect(studentTTwoSided(2.0, 20)).toBeCloseTo(0.0593, 3);
    expect(studentTTwoSided(0, 5)).toBeCloseTo(1, 12);
  });

  it('spearman p-value edge cases', () => {
    expect(spearmanPValue(1, 12)).toBe(0);
    expect(spearmanPValue(0, 12)).toBeCloseTo(1, 12);
  });
});

describe('pairing and association', () => {
  const H = 3600_000;
  const t0 = Date.UTC(2026, 9, 1, 9);

  it('pairs within the window, one-to-one, nearest first', () => {
    const sessions = [makeSession({ id: 's1', startedAt: t0 }), makeSession({ id: 's2', startedAt: t0 + 30 * 60_000 })];
    const assessments = [
      makeAssessment({ id: 'a1', assessedAt: t0 + 25 * 60_000 }),
      makeAssessment({ id: 'a2', assessedAt: t0 + 5 * H }), // outside window of both
    ];
    const pairs = pairObservations(sessions, assessments, 'knee', 'right', null, 'pain');
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ sessionId: 's2', assessmentId: 'a1' });
  });

  it('ignores other joints, sides and (when given) movements', () => {
    const sessions = [makeSession({ id: 's1', startedAt: t0, side: 'left' }), makeSession({ id: 's2', startedAt: t0, movement: 'extension' })];
    const assessments = [makeAssessment({ id: 'a1', assessedAt: t0 })];
    expect(pairObservations(sessions, assessments, 'knee', 'right', 'flexion', 'pain')).toHaveLength(0);
    expect(pairObservations(sessions, assessments, 'knee', 'right', null, 'pain')).toHaveLength(1);
  });

  it('refuses to compute with too few pairs', () => {
    const r = associate(
      Array.from({ length: 9 }, (_, i) => ({ sessionId: `s${i}`, assessmentId: `a${i}`, sessionTime: i, assessmentTime: i, romDeg: i, symptom: i })),
    );
    expect(r.status).toBe('insufficient');
  });

  it('computes rho and p with enough pairs', () => {
    const pairs = Array.from({ length: 12 }, (_, i) => ({
      sessionId: `s${i}`,
      assessmentId: `a${i}`,
      sessionTime: i,
      assessmentTime: i,
      romDeg: 100 - i * 5,
      symptom: Math.min(10, i),
    }));
    const r = associate(pairs);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.rho).toBeLessThan(-0.95);
    expect(r.pValue).toBeLessThan(0.001);
  });
});

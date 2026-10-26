import type { MovementSession, SymptomAssessment } from '@/domain/types';

let counter = 0;

export function makeSession(overrides: Partial<MovementSession> = {}): MovementSession {
  counter++;
  const startedAt = overrides.startedAt ?? Date.UTC(2026, 9, 20, 10, 0, 0);
  return {
    id: `session-${counter}`,
    ownerUid: 'user-1',
    joint: 'knee',
    side: 'right',
    movement: 'flexion',
    source: 'imported',
    isSynthetic: false,
    sourceFileName: 'knee.csv',
    sourceFormat: 'csv',
    startedAt,
    endedAt: startedAt + 10_000,
    createdAt: startedAt + 60_000,
    metrics: {
      sampleCount: 101,
      minDeg: 5,
      maxDeg: 95,
      romDeg: 90,
      meanDeg: 50,
      durationMs: 10_000,
      interval: { min: 100, max: 100, mean: 100, median: 100, sd: 0, rateHz: 10 },
      quality: { irregularIntervals: 0, irregularIntervalPct: 0 },
      repetitions: 3,
      repetitionNote: null,
    },
    calibrationId: null,
    calibrationStatus: 'not-calibrated',
    notes: '',
    chunkCount: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

export function makeAssessment(overrides: Partial<SymptomAssessment> = {}): SymptomAssessment {
  counter++;
  const assessedAt = overrides.assessedAt ?? Date.UTC(2026, 9, 20, 10, 30, 0);
  return {
    id: `assessment-${counter}`,
    ownerUid: 'user-1',
    joint: 'knee',
    side: 'right',
    pain: 3,
    stiffness: 4,
    discomfort: 2,
    durationMinutes: 30,
    notes: '',
    assessedAt,
    createdAt: assessedAt,
    updatedAt: null,
    isSynthetic: false,
    schemaVersion: 1,
    ...overrides,
  };
}

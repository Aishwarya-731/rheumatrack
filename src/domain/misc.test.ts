import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { evaluateStaticHold } from './calibration';
import {
  assessmentsToCsv,
  buildExportBundle,
  samplesToCsv,
  samplesToJson,
  sessionToRow,
  sessionsToCsv,
  SESSION_EXPORT_COLUMNS,
} from './export';
import { dateInputsToRange, EMPTY_FILTER, filterAssessments, filterSessions, presetRange } from './filters';
import { isMovementSupported, jointLabel, movementsFor } from './joints';
import { buildReminderIcs, dueOccurrence, nextOccurrence, occurrencesBetween, timeZoneOffsetMs, validateReminderSettings } from './reminders';
import { parseLocalDateTime, validateSymptomForm, type SymptomFormValues } from './symptoms';
import { generateSynthetic, mulberry32 } from './synthetic';
import { validateMovementFile } from './validation';
import { computeMetrics } from './metrics';
import { leftRightComparison, summarise, dailyCounts, latestPerMovement } from './analytics';
import { makeAssessment, makeSession } from '@/test/factories';

describe('joint catalogue', () => {
  it('supports the required movements', () => {
    expect(isMovementSupported('shoulder', 'abduction')).toBe(true);
    expect(isMovementSupported('ankle', 'dorsiflexion')).toBe(true);
    expect(isMovementSupported('ankle', 'plantarflexion')).toBe(true);
    expect(isMovementSupported('knee', 'abduction')).toBe(false);
    expect(movementsFor('elbow').map((m) => m.id)).toEqual(['flexion', 'extension']);
    expect(jointLabel('knee', 'right')).toBe('Right knee');
  });
});

describe('symptom form validation', () => {
  const now = new Date(2026, 9, 26, 12, 0).getTime();
  const base: SymptomFormValues = {
    joint: 'knee',
    side: 'left',
    pain: 3,
    stiffness: 5,
    discomfort: 0,
    durationMinutes: '45',
    notes: '  Stiff after waking  ',
    assessedAtLocal: '2026-10-26T08:30',
  };

  it('accepts valid input and trims notes', () => {
    const r = validateSymptomForm(base, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.durationMinutes).toBe(45);
    expect(r.value.notes).toBe('Stiff after waking');
    expect(r.value.assessedAt).toBe(new Date(2026, 9, 26, 8, 30).getTime());
  });

  it('allows an empty duration (not reported)', () => {
    const r = validateSymptomForm({ ...base, durationMinutes: '' }, now);
    expect(r.ok && r.value.durationMinutes).toBeNull();
  });

  it('rejects missing joint/side, out-of-range scores, bad durations, future times', () => {
    const r = validateSymptomForm(
      { ...base, joint: '', side: '', pain: 11, stiffness: -1, discomfort: 2.5, durationMinutes: '1.5', assessedAtLocal: '2026-10-27T12:00' },
      now,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['assessedAtLocal', 'discomfort', 'durationMinutes', 'joint', 'pain', 'side', 'stiffness'].sort());
  });

  it('rejects durations over 24 h and overly long notes', () => {
    const r = validateSymptomForm({ ...base, durationMinutes: '1441', notes: 'x'.repeat(2001) }, now);
    expect(r.ok).toBe(false);
  });

  it('parses local datetime strictly', () => {
    expect(parseLocalDateTime('2026-02-30T10:00')).toBeNull();
    expect(parseLocalDateTime('nonsense')).toBeNull();
  });
});

describe('history filtering', () => {
  const s1 = makeSession({ id: 's1', joint: 'knee', side: 'left', movement: 'flexion', startedAt: 1000 });
  const s2 = makeSession({ id: 's2', joint: 'knee', side: 'right', movement: 'extension', startedAt: 3000 });
  const s3 = makeSession({ id: 's3', joint: 'hip', side: 'right', movement: 'flexion', startedAt: 2000 });
  const a1 = makeAssessment({ id: 'a1', joint: 'knee', side: 'left', assessedAt: 1500 });
  const a2 = makeAssessment({ id: 'a2', joint: 'hip', side: 'right', assessedAt: 2500 });

  it('returns everything, newest first, with an empty filter', () => {
    expect(filterSessions([s1, s2, s3], EMPTY_FILTER).map((s) => s.id)).toEqual(['s2', 's3', 's1']);
  });

  it('filters by joint, side, movement and inclusive date range', () => {
    expect(filterSessions([s1, s2, s3], { ...EMPTY_FILTER, joint: 'knee' }).map((s) => s.id)).toEqual(['s2', 's1']);
    expect(filterSessions([s1, s2, s3], { ...EMPTY_FILTER, side: 'right', movement: 'flexion' }).map((s) => s.id)).toEqual(['s3']);
    expect(filterSessions([s1, s2, s3], { ...EMPTY_FILTER, from: 1000, to: 2000 }).map((s) => s.id)).toEqual(['s3', 's1']);
    expect(filterAssessments([a1, a2], { ...EMPTY_FILTER, joint: 'hip', movement: 'flexion' }).map((a) => a.id)).toEqual(['a2']);
  });

  it('builds ranges from presets and date inputs', () => {
    const now = 10 * 86_400_000;
    expect(presetRange('7d', now)).toEqual({ from: 3 * 86_400_000, to: now });
    expect(presetRange('all', now)).toEqual({ from: null, to: null });
    const r = dateInputsToRange('2026-10-01', '2026-10-02');
    expect(r.from).toBe(new Date(2026, 9, 1).getTime());
    expect(r.to).toBe(new Date(2026, 9, 2, 23, 59, 59, 999).getTime());
    expect(dateInputsToRange('', '')).toEqual({ from: null, to: null });
  });
});

describe('export consistency', () => {
  const s = makeSession({ id: 's1', notes: '=HYPERLINK("x")', metrics: { ...makeSession().metrics, romDeg: 61.912345678, minDeg: 16.8, maxDeg: 78.712345678 } });

  it('session CSV round-trips the exact stored numbers', () => {
    const csv = sessionsToCsv([s]);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true }).data[0]!;
    expect(Object.keys(parsed)).toEqual([...SESSION_EXPORT_COLUMNS]);
    expect(Number(parsed.observedRomDeg)).toBe(s.metrics.romDeg);
    expect(Number(parsed.maxDeg)).toBe(s.metrics.maxDeg);
    expect(parsed.startedAt).toBe(new Date(s.startedAt).toISOString());
    expect(parsed.dataSourceLabel).toBe('Imported movement data');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    const parsed = Papa.parse<Record<string, string>>(sessionsToCsv([s]), { header: true }).data[0]!;
    expect(parsed.notes?.startsWith("'=")).toBe(true);
  });

  it('JSON bundle equals the row mapping', () => {
    const a = makeAssessment();
    const b = buildExportBundle([s], [a], { joint: 'knee' }, 0);
    expect(b.sessions[0]).toEqual(sessionToRow(s));
    expect(b.assessments).toHaveLength(1);
    expect(assessmentsToCsv([a]).split('\n')).toHaveLength(2);
  });

  it('raw sample exports re-import to the same samples and metrics', () => {
    const samples = generateSynthetic({
      joint: 'knee', side: 'right', movement: 'flexion', startMs: Date.UTC(2026, 9, 1), sampleRateHz: 50,
      durationS: 4, baseDeg: 5, amplitudeDeg: 100, periodS: 2, noiseSdDeg: 0.5, seed: 42,
    });
    for (const [name, text] of [
      ['x.csv', samplesToCsv({ joint: 'knee', side: 'right', movement: 'flexion' }, samples)],
      ['x.json', samplesToJson({ joint: 'knee', side: 'right', movement: 'flexion', source: 'simulation' }, samples)],
    ] as const) {
      const res = validateMovementFile(name, text, text.length);
      expect(res.ok, name).toBe(true);
      if (!res.ok) return;
      expect(res.recording.samples).toEqual(samples);
      expect(computeMetrics(res.recording.samples)).toEqual(computeMetrics(samples));
    }
  });
});

describe('synthetic generator', () => {
  it('is deterministic for a seed', () => {
    const r1 = mulberry32(7);
    const r2 = mulberry32(7);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it('produces the configured length and sampling interval', () => {
    const s = generateSynthetic({ joint: 'elbow', side: 'left', movement: 'flexion', startMs: 0, sampleRateHz: 50, durationS: 2, baseDeg: 0, amplitudeDeg: 90, periodS: 1, noiseSdDeg: 0, seed: 1 });
    expect(s).toHaveLength(101);
    expect(s[1]!.t - s[0]!.t).toBe(20);
    expect(computeMetrics(s).repetitions).toBe(2);
  });
});

describe('calibration static hold', () => {
  const still = Array.from({ length: 60 }, (_, i) => ({ t: i * 50, angleDeg: 2 + (i % 2 ? 0.3 : -0.3) }));
  it('passes a still, long-enough hold', () => {
    const r = evaluateStaticHold(still);
    expect(r.passed).toBe(true);
    expect(r.referenceAngleDeg).toBeCloseTo(2, 10);
  });
  it('fails a moving or short hold', () => {
    expect(evaluateStaticHold(still.map((s, i) => ({ ...s, angleDeg: i }))).passed).toBe(false);
    expect(evaluateStaticHold(still.slice(0, 20)).passed).toBe(false);
  });
});

describe('reminders', () => {
  const r = { enabled: true, time: '09:00', days: [1, 2, 3, 4, 5], timezone: 'Asia/Kolkata' };

  it('validates settings', () => {
    expect(validateReminderSettings(r)).toBeNull();
    expect(validateReminderSettings({ ...r, time: '25:00' })).not.toBeNull();
    expect(validateReminderSettings({ ...r, days: [] })).not.toBeNull();
    expect(validateReminderSettings({ ...r, timezone: 'Mars/Base' })).not.toBeNull();
  });

  it('handles timezone offsets', () => {
    expect(timeZoneOffsetMs(Date.UTC(2026, 9, 26), 'Asia/Kolkata')).toBe(5.5 * 3600_000);
  });

  it('computes the next weekday occurrence in the configured timezone', () => {
    // Fri 30 Oct 2026 10:00 IST → next is Mon 2 Nov 09:00 IST = 03:30 UTC
    const now = Date.UTC(2026, 9, 30, 4, 30);
    expect(nextOccurrence(r, now)).toBe(Date.UTC(2026, 10, 2, 3, 30));
    expect(nextOccurrence({ ...r, enabled: false }, now)).toBeNull();
  });

  it('lists occurrences in a range', () => {
    const occ = occurrencesBetween(r, Date.UTC(2026, 9, 26), Date.UTC(2026, 10, 2));
    expect(occ).toHaveLength(5);
  });

  it('is due only until an assessment is saved after the scheduled time', () => {
    const now = Date.UTC(2026, 9, 26, 5, 0); // Mon 10:30 IST
    const scheduled = Date.UTC(2026, 9, 26, 3, 30);
    expect(dueOccurrence(r, now, null)).toBe(scheduled);
    expect(dueOccurrence(r, now, scheduled + 1)).toBeNull();
    expect(dueOccurrence(r, now, scheduled - 1)).toBe(scheduled);
  });

  it('builds a weekly ICS event', () => {
    const ics = buildReminderIcs(r, Date.UTC(2026, 9, 26, 0, 0));
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20261026T090000');
    expect(ics).toContain('BEGIN:VALARM');
  });
});

describe('analytics', () => {
  it('summarises only the records passed in', () => {
    const s = summarise([], []);
    expect(s).toEqual({ sessionCount: 0, assessmentCount: 0, jointsTracked: 0, latestSession: null, latestAssessment: null });
    const s2 = summarise([makeSession({ joint: 'knee', side: 'left' }), makeSession({ joint: 'knee', side: 'right' })], [makeAssessment({ joint: 'knee', side: 'left' })]);
    expect(s2.jointsTracked).toBe(2);
  });

  it('only compares left and right when both sides have the same movement', () => {
    const rows = leftRightComparison([
      makeSession({ side: 'left', movement: 'flexion', metrics: { ...makeSession().metrics, romDeg: 100 } }),
      makeSession({ side: 'right', movement: 'flexion', metrics: { ...makeSession().metrics, romDeg: 80 } }),
      makeSession({ side: 'left', movement: 'extension' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ movement: 'flexion', left: { romDeg: 100 }, right: { romDeg: 80 } });
  });

  it('counts per local day including empty days', () => {
    const d0 = new Date(2026, 9, 1, 12).getTime();
    const days = dailyCounts([d0, d0 + 1000, d0 + 2 * 86_400_000], d0, d0 + 3 * 86_400_000);
    expect(days.map((d) => d.count)).toEqual([2, 0, 1, 0]);
  });

  it('latest session per movement', () => {
    const m = latestPerMovement(
      [makeSession({ id: 'old', startedAt: 1 }), makeSession({ id: 'new', startedAt: 2 }), makeSession({ id: 'ext', movement: 'extension' })],
      'knee',
      'right',
    );
    expect(m.get('flexion')?.id).toBe('new');
    expect(m.get('extension')?.id).toBe('ext');
  });
});

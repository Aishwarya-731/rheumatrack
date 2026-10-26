import type { Joint, Movement, Side } from './joints';
import type { MovementSession, SymptomAssessment } from './types';

export interface RecordFilter {
  joint: Joint | 'all';
  side: Side | 'all';
  movement: Movement | 'all';
  /** Inclusive range in epoch ms; null = unbounded. */
  from: number | null;
  to: number | null;
}

export const EMPTY_FILTER: RecordFilter = { joint: 'all', side: 'all', movement: 'all', from: null, to: null };

function inRange(t: number, f: RecordFilter): boolean {
  return (f.from === null || t >= f.from) && (f.to === null || t <= f.to);
}

export function filterSessions(sessions: readonly MovementSession[], f: RecordFilter): MovementSession[] {
  return sessions
    .filter(
      (s) =>
        (f.joint === 'all' || s.joint === f.joint) &&
        (f.side === 'all' || s.side === f.side) &&
        (f.movement === 'all' || s.movement === f.movement) &&
        inRange(s.startedAt, f),
    )
    .sort((a, b) => b.startedAt - a.startedAt || b.createdAt - a.createdAt);
}

/** Movement is not a property of assessments, so the movement filter does not apply to them. */
export function filterAssessments(assessments: readonly SymptomAssessment[], f: RecordFilter): SymptomAssessment[] {
  return assessments
    .filter(
      (a) => (f.joint === 'all' || a.joint === f.joint) && (f.side === 'all' || a.side === f.side) && inRange(a.assessedAt, f),
    )
    .sort((a, b) => b.assessedAt - a.assessedAt || b.createdAt - a.createdAt);
}

export type RangePreset = '7d' | '30d' | '90d' | 'all';

export const RANGE_PRESETS: ReadonlyArray<{ id: RangePreset; label: string; days: number | null }> = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: 'all', label: 'All', days: null },
];

/** Range for a preset, ending now. "7 days" = the last 7×24 h. */
export function presetRange(preset: RangePreset, now: number = Date.now()): { from: number | null; to: number | null } {
  const def = RANGE_PRESETS.find((p) => p.id === preset);
  if (!def || def.days === null) return { from: null, to: null };
  return { from: now - def.days * 24 * 60 * 60 * 1000, to: now };
}

/** Converts date-input values ("YYYY-MM-DD", local) into an inclusive epoch range. */
export function dateInputsToRange(fromDate: string, toDate: string): { from: number | null; to: number | null } {
  const parse = (v: string, endOfDay: boolean): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return null;
    const d = endOfDay
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
      : new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
    return d.getTime();
  };
  return { from: parse(fromDate, false), to: parse(toDate, true) };
}

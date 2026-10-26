import { JOINTS, SIDES, jointKey, type Joint, type JointKey, type Movement, type Side } from './joints';
import type { MovementSession, SymptomAssessment } from './types';

/** All dashboard figures are derived here from the records passed in — never invented. */

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Count of timestamps per local calendar day, oldest → newest, including empty days. */
export function dailyCounts(times: readonly number[], from: number, to: number): Array<{ day: number; count: number }> {
  const start = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  const days: Array<{ day: number; count: number }> = [];
  const index = new Map<number, number>();
  for (let d = start; d <= end; ) {
    index.set(d, days.length);
    days.push({ day: d, count: 0 });
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    d = next.getTime();
    if (days.length > 3700) break; // safety bound (~10 years)
  }
  for (const t of times) {
    const i = index.get(startOfLocalDay(t));
    if (i !== undefined) (days[i] as { count: number }).count++;
  }
  return days;
}

export interface DashboardSummary {
  sessionCount: number;
  assessmentCount: number;
  jointsTracked: number;
  latestSession: MovementSession | null;
  latestAssessment: SymptomAssessment | null;
}

export function summarise(sessions: readonly MovementSession[], assessments: readonly SymptomAssessment[]): DashboardSummary {
  const keys = new Set<JointKey>();
  for (const s of sessions) keys.add(jointKey(s.joint, s.side));
  for (const a of assessments) keys.add(jointKey(a.joint, a.side));
  const latestSession = [...sessions].sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
  const latestAssessment = [...assessments].sort((a, b) => b.assessedAt - a.assessedAt)[0] ?? null;
  return {
    sessionCount: sessions.length,
    assessmentCount: assessments.length,
    jointsTracked: keys.size,
    latestSession,
    latestAssessment,
  };
}

export interface RomPoint {
  t: number;
  romDeg: number;
  sessionId: string;
  synthetic: boolean;
}

export function romSeries(sessions: readonly MovementSession[], joint: Joint, side: Side, movement: Movement): RomPoint[] {
  return sessions
    .filter((s) => s.joint === joint && s.side === side && s.movement === movement)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({ t: s.startedAt, romDeg: s.metrics.romDeg, sessionId: s.id, synthetic: s.isSynthetic }));
}

export interface SymptomPoint {
  t: number;
  pain: number;
  stiffness: number;
  discomfort: number;
  assessmentId: string;
}

export function symptomSeries(assessments: readonly SymptomAssessment[], joint: Joint, side: Side): SymptomPoint[] {
  return assessments
    .filter((a) => a.joint === joint && a.side === side)
    .sort((a, b) => a.assessedAt - b.assessedAt)
    .map((a) => ({ t: a.assessedAt, pain: a.pain, stiffness: a.stiffness, discomfort: a.discomfort, assessmentId: a.id }));
}

export interface LeftRightRow {
  joint: Joint;
  movement: Movement;
  left: { romDeg: number; at: number; sessionId: string };
  right: { romDeg: number; at: number; sessionId: string };
}

/** Latest observed ROM per side, only where BOTH sides have a session of the same movement. */
export function leftRightComparison(sessions: readonly MovementSession[]): LeftRightRow[] {
  const latest = new Map<string, MovementSession>();
  for (const s of sessions) {
    const k = `${s.joint}|${s.movement}|${s.side}`;
    const cur = latest.get(k);
    if (!cur || s.startedAt > cur.startedAt) latest.set(k, s);
  }
  const rows: LeftRightRow[] = [];
  for (const joint of JOINTS) {
    const movements = new Set(sessions.filter((s) => s.joint === joint).map((s) => s.movement));
    for (const movement of movements) {
      const l = latest.get(`${joint}|${movement}|left`);
      const r = latest.get(`${joint}|${movement}|right`);
      if (l && r) {
        rows.push({
          joint,
          movement,
          left: { romDeg: l.metrics.romDeg, at: l.startedAt, sessionId: l.id },
          right: { romDeg: r.metrics.romDeg, at: r.startedAt, sessionId: r.id },
        });
      }
    }
  }
  return rows;
}

export interface JointSummaryRow {
  joint: Joint;
  side: Side;
  sessionCount: number;
  assessmentCount: number;
  latestRom: { romDeg: number; movement: Movement; at: number } | null;
  latestPain: { value: number; at: number } | null;
}

export function jointSummaries(sessions: readonly MovementSession[], assessments: readonly SymptomAssessment[]): JointSummaryRow[] {
  const rows: JointSummaryRow[] = [];
  for (const joint of JOINTS) {
    for (const side of SIDES) {
      const ss = sessions.filter((s) => s.joint === joint && s.side === side);
      const as = assessments.filter((a) => a.joint === joint && a.side === side);
      if (ss.length === 0 && as.length === 0) continue;
      const ls = [...ss].sort((a, b) => b.startedAt - a.startedAt)[0];
      const la = [...as].sort((a, b) => b.assessedAt - a.assessedAt)[0];
      rows.push({
        joint,
        side,
        sessionCount: ss.length,
        assessmentCount: as.length,
        latestRom: ls ? { romDeg: ls.metrics.romDeg, movement: ls.movement, at: ls.startedAt } : null,
        latestPain: la ? { value: la.pain, at: la.assessedAt } : null,
      });
    }
  }
  return rows;
}

/** Latest session per movement for one joint/side — used for the ROM rings. */
export function latestPerMovement(sessions: readonly MovementSession[], joint: Joint, side: Side): Map<Movement, MovementSession> {
  const out = new Map<Movement, MovementSession>();
  for (const s of sessions) {
    if (s.joint !== joint || s.side !== side) continue;
    const cur = out.get(s.movement);
    if (!cur || s.startedAt > cur.startedAt) out.set(s.movement, s);
  }
  return out;
}

export type ActivityItem =
  | { kind: 'session'; at: number; record: MovementSession }
  | { kind: 'assessment'; at: number; record: SymptomAssessment };

export function recentActivity(sessions: readonly MovementSession[], assessments: readonly SymptomAssessment[], limit = 8): ActivityItem[] {
  const items: ActivityItem[] = [
    ...sessions.map((s) => ({ kind: 'session' as const, at: s.createdAt, record: s })),
    ...assessments.map((a) => ({ kind: 'assessment' as const, at: a.createdAt, record: a })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

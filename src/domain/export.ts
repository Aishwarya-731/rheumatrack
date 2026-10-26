import Papa from 'papaparse';
import { JSON_FORMAT_ID } from './validation';
import { toIsoUtc } from './timestamps';
import type { AngleSample, MovementSession, SymptomAssessment } from './types';
import { DATA_SOURCE_LABEL } from './types';

/**
 * Export formats (docs/DATA_CONTRACT.md §6). Every exported value comes directly from the
 * stored record; numbers are written at full precision so exports match the records exactly.
 * Rounding happens only in on-screen display.
 */

export const SESSION_EXPORT_COLUMNS = [
  'sessionId',
  'joint',
  'side',
  'movement',
  'dataSource',
  'dataSourceLabel',
  'synthetic',
  'startedAt',
  'endedAt',
  'sampleCount',
  'minDeg',
  'maxDeg',
  'observedRomDeg',
  'meanDeg',
  'durationMs',
  'medianIntervalMs',
  'samplingRateHz',
  'irregularIntervals',
  'repetitions',
  'calibrationStatus',
  'calibrationId',
  'sourceFileName',
  'notes',
] as const;

export const ASSESSMENT_EXPORT_COLUMNS = [
  'assessmentId',
  'joint',
  'side',
  'assessedAt',
  'pain',
  'stiffness',
  'discomfort',
  'durationMinutes',
  'synthetic',
  'createdAt',
  'updatedAt',
  'notes',
] as const;

export function sessionToRow(s: MovementSession): Record<(typeof SESSION_EXPORT_COLUMNS)[number], string | number | boolean | null> {
  return {
    sessionId: s.id,
    joint: s.joint,
    side: s.side,
    movement: s.movement,
    dataSource: s.source,
    dataSourceLabel: DATA_SOURCE_LABEL[s.source],
    synthetic: s.isSynthetic,
    startedAt: toIsoUtc(s.startedAt),
    endedAt: toIsoUtc(s.endedAt),
    sampleCount: s.metrics.sampleCount,
    minDeg: s.metrics.minDeg,
    maxDeg: s.metrics.maxDeg,
    observedRomDeg: s.metrics.romDeg,
    meanDeg: s.metrics.meanDeg,
    durationMs: s.metrics.durationMs,
    medianIntervalMs: s.metrics.interval.median,
    samplingRateHz: s.metrics.interval.rateHz,
    irregularIntervals: s.metrics.quality.irregularIntervals,
    repetitions: s.metrics.repetitions,
    calibrationStatus: s.calibrationStatus,
    calibrationId: s.calibrationId,
    sourceFileName: s.sourceFileName,
    notes: s.notes,
  };
}

export function assessmentToRow(a: SymptomAssessment): Record<(typeof ASSESSMENT_EXPORT_COLUMNS)[number], string | number | boolean | null> {
  return {
    assessmentId: a.id,
    joint: a.joint,
    side: a.side,
    assessedAt: toIsoUtc(a.assessedAt),
    pain: a.pain,
    stiffness: a.stiffness,
    discomfort: a.discomfort,
    durationMinutes: a.durationMinutes,
    synthetic: a.isSynthetic,
    createdAt: toIsoUtc(a.createdAt),
    updatedAt: a.updatedAt === null ? null : toIsoUtc(a.updatedAt),
    notes: a.notes,
  };
}

/** Neutralise spreadsheet formula injection (cells starting with = + - @ tab CR). */
function safeCell(v: string | number | boolean | null): string | number | boolean {
  if (v === null) return '';
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}

export function toCsv<C extends string>(columns: readonly C[], rows: ReadonlyArray<Record<C, string | number | boolean | null>>): string {
  return Papa.unparse(
    {
      fields: [...columns],
      data: rows.map((r) => columns.map((c) => safeCell(r[c]))),
    },
    { newline: '\n' },
  );
}

export function sessionsToCsv(sessions: readonly MovementSession[]): string {
  return toCsv(SESSION_EXPORT_COLUMNS, sessions.map(sessionToRow));
}

export function assessmentsToCsv(assessments: readonly SymptomAssessment[]): string {
  return toCsv(ASSESSMENT_EXPORT_COLUMNS, assessments.map(assessmentToRow));
}

export interface ExportBundle {
  format: 'rheumatrack.export.v1';
  exportedAt: string;
  notice: string;
  filters: Record<string, string | null>;
  sessions: Array<ReturnType<typeof sessionToRow>>;
  assessments: Array<ReturnType<typeof assessmentToRow>>;
}

export const EXPORT_NOTICE =
  'Observed values from user records. Not a diagnosis. Observed range of motion is not a clinically validated assessment. Check dataSource and synthetic for each record.';

export function buildExportBundle(
  sessions: readonly MovementSession[],
  assessments: readonly SymptomAssessment[],
  filters: Record<string, string | null>,
  now: number = Date.now(),
): ExportBundle {
  return {
    format: 'rheumatrack.export.v1',
    exportedAt: toIsoUtc(now),
    notice: EXPORT_NOTICE,
    filters,
    sessions: sessions.map(sessionToRow),
    assessments: assessments.map(assessmentToRow),
  };
}

/** Raw samples of one session in the import format, so an export can be re-imported. */
export function samplesToCsv(session: Pick<MovementSession, 'joint' | 'side' | 'movement'>, samples: readonly AngleSample[]): string {
  const lines = ['timestamp,joint,side,movement,angleDeg'];
  for (const s of samples) lines.push(`${toIsoUtc(s.t)},${session.joint},${session.side},${session.movement},${s.angleDeg}`);
  return lines.join('\n') + '\n';
}

export function samplesToJson(
  session: Pick<MovementSession, 'joint' | 'side' | 'movement' | 'source'>,
  samples: readonly AngleSample[],
): string {
  return JSON.stringify(
    {
      format: JSON_FORMAT_ID,
      joint: session.joint,
      side: session.side,
      movement: session.movement,
      unit: 'deg',
      source: session.source,
      samples: samples.map((s) => ({ timestamp: toIsoUtc(s.t), angleDeg: s.angleDeg })),
    },
    null,
    2,
  );
}

export function exportFileStamp(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

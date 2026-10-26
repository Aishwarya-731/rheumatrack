import Papa from 'papaparse';
import { ANALYSIS_CONFIG } from './analysisConfig';
import { isJoint, isMovement, isMovementSupported, isSide, type Joint, type Movement, type Side } from './joints';
import { median } from './metrics';
import { parseIsoTimestamp } from './timestamps';
import type { AngleSample } from './types';

/**
 * Movement-file validation (data contract: docs/DATA_CONTRACT.md).
 * Invalid input is rejected with row-level messages. Nothing is repaired, sorted,
 * de-duplicated or interpolated: the caller either gets exactly the file's samples or errors.
 */

export const CSV_COLUMNS = ['timestamp', 'joint', 'side', 'movement', 'angleDeg'] as const;
export const JSON_FORMAT_ID = 'rheumatrack.movement.v1';
const JSON_TOP_LEVEL_KEYS = new Set(['format', 'joint', 'side', 'movement', 'unit', 'source', 'description', 'generator', 'samples']);
const JSON_SAMPLE_KEYS = new Set(['timestamp', 'angleDeg']);
const MAX_REPORTED_ERRORS = 200;
const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export interface ValidationIssue {
  /** 1-based data row (header excluded for CSV; array index + 1 for JSON). Null = whole file. */
  row: number | null;
  field: string | null;
  message: string;
}

export interface ParsedRecording {
  joint: Joint;
  side: Side;
  movement: Movement;
  samples: AngleSample[];
  format: 'csv' | 'json';
  /** Declared source in a JSON file, if present (informational; the user confirms the source). */
  declaredSource: string | null;
}

export type ValidationResult =
  | { ok: true; recording: ParsedRecording; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[]; totalErrors: number; warnings: ValidationIssue[] };

class IssueCollector {
  readonly errors: ValidationIssue[] = [];
  readonly warnings: ValidationIssue[] = [];
  total = 0;
  error(row: number | null, field: string | null, message: string): void {
    this.total++;
    if (this.errors.length < MAX_REPORTED_ERRORS) this.errors.push({ row, field, message });
  }
  warn(row: number | null, field: string | null, message: string): void {
    this.warnings.push({ row, field, message });
  }
  get hasErrors(): boolean {
    return this.total > 0;
  }
  fail(): ValidationResult {
    return { ok: false, errors: this.errors, totalErrors: this.total, warnings: this.warnings };
  }
}

export function detectFormat(fileName: string): 'csv' | 'json' | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.json')) return 'json';
  return null;
}

/** Validate a movement file. `byteLength` is the original file size. */
export function validateMovementFile(fileName: string, text: string, byteLength: number): ValidationResult {
  const c = new IssueCollector();
  if (byteLength > ANALYSIS_CONFIG.maxFileBytes) {
    c.error(null, null, `File is too large (${formatBytes(byteLength)}). The maximum is ${formatBytes(ANALYSIS_CONFIG.maxFileBytes)}.`);
    return c.fail();
  }
  const format = detectFormat(fileName);
  if (!format) {
    c.error(null, null, 'Unsupported file type. Upload a .csv or .json file in the RheumaTrack movement format.');
    return c.fail();
  }
  if (text.trim() === '') {
    c.error(null, null, 'The file is empty.');
    return c.fail();
  }
  return format === 'csv' ? validateCsv(text, c) : validateJson(text, c);
}

interface RawRow {
  row: number;
  timestamp: unknown;
  angleDeg: unknown;
  joint?: unknown;
  side?: unknown;
  movement?: unknown;
}

function validateCsv(text: string, c: IssueCollector): ValidationResult {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: false });
  const rows = parsed.data;
  // Drop trailing completely-empty lines (a final newline is normal).
  while (rows.length > 0 && isBlankRow(rows[rows.length - 1] as string[])) rows.pop();
  if (rows.length === 0) {
    c.error(null, null, 'The file is empty.');
    return c.fail();
  }
  const header = (rows[0] as string[]).map((h) => h.trim());
  const missing = CSV_COLUMNS.filter((col) => !header.includes(col));
  const unknown = header.filter((h) => !(CSV_COLUMNS as readonly string[]).includes(h));
  const duplicated = header.filter((h, i) => header.indexOf(h) !== i);
  if (missing.length > 0) c.error(null, null, `Missing required column(s): ${missing.join(', ')}. Expected header: ${CSV_COLUMNS.join(',')}`);
  if (unknown.length > 0) {
    const hint = unknown.some((u) => /rad/i.test(u)) ? ' Angles must be in degrees in a column named angleDeg.' : '';
    c.error(null, null, `Unexpected column(s): ${unknown.join(', ')}.${hint}`);
  }
  if (duplicated.length > 0) c.error(null, null, `Duplicate column(s): ${[...new Set(duplicated)].join(', ')}.`);
  if (c.hasErrors) return c.fail();

  const idx = Object.fromEntries(CSV_COLUMNS.map((col) => [col, header.indexOf(col)])) as Record<(typeof CSV_COLUMNS)[number], number>;
  const raw: RawRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i] as string[];
    const rowNo = i;
    if (isBlankRow(cells)) {
      c.error(rowNo, null, 'Empty row inside the data.');
      continue;
    }
    if (cells.length !== header.length) {
      c.error(rowNo, null, `Expected ${header.length} values but found ${cells.length}.`);
      continue;
    }
    raw.push({
      row: rowNo,
      timestamp: cells[idx.timestamp],
      angleDeg: cells[idx.angleDeg],
      joint: cells[idx.joint],
      side: cells[idx.side],
      movement: cells[idx.movement],
    });
  }
  if (raw.length === 0 && !c.hasErrors) {
    c.error(null, null, 'The file has a header but no data rows.');
    return c.fail();
  }
  return finish(raw, 'csv', null, c, true);
}

function validateJson(text: string, c: IssueCollector): ValidationResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    c.error(null, null, `The file is not valid JSON (${e instanceof Error ? e.message : 'parse error'}).`);
    return c.fail();
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    c.error(null, null, 'The JSON file must contain an object with format, joint, side, movement, unit and samples.');
    return c.fail();
  }
  const obj = doc as Record<string, unknown>;
  const unknownKeys = Object.keys(obj).filter((k) => !JSON_TOP_LEVEL_KEYS.has(k));
  if (unknownKeys.length > 0) c.error(null, null, `Unexpected field(s): ${unknownKeys.join(', ')}.`);
  if (obj.format !== JSON_FORMAT_ID) c.error(null, 'format', `"format" must be "${JSON_FORMAT_ID}".`);
  if (obj.unit !== 'deg') c.error(null, 'unit', '"unit" must be "deg"; angles must be supplied in degrees.');
  for (const key of ['joint', 'side', 'movement'] as const) {
    if (obj[key] === undefined) c.error(null, key, `"${key}" is required.`);
  }
  if (obj.source !== undefined && typeof obj.source !== 'string') c.error(null, 'source', '"source" must be a string.');
  if (!Array.isArray(obj.samples)) {
    c.error(null, 'samples', '"samples" must be an array of { "timestamp", "angleDeg" } objects.');
    return c.fail();
  }
  if (obj.samples.length === 0) {
    c.error(null, 'samples', 'The file contains no samples.');
    return c.fail();
  }
  if (obj.samples.length > ANALYSIS_CONFIG.maxSamples) {
    c.error(null, 'samples', tooManySamplesMessage(obj.samples.length));
    return c.fail();
  }
  const raw: RawRow[] = [];
  obj.samples.forEach((s: unknown, i: number) => {
    const rowNo = i + 1;
    if (typeof s !== 'object' || s === null || Array.isArray(s)) {
      c.error(rowNo, null, 'Each sample must be an object with "timestamp" and "angleDeg".');
      return;
    }
    const rec = s as Record<string, unknown>;
    const extra = Object.keys(rec).filter((k) => !JSON_SAMPLE_KEYS.has(k));
    if (extra.length > 0) c.error(rowNo, null, `Unexpected field(s) in sample: ${extra.join(', ')}.`);
    raw.push({ row: rowNo, timestamp: rec.timestamp, angleDeg: rec.angleDeg });
  });
  if (c.hasErrors) return c.fail();
  const header = { joint: obj.joint, side: obj.side, movement: obj.movement };
  return finish(
    raw.map((r) => ({ ...r, ...header })),
    'json',
    typeof obj.source === 'string' ? obj.source : null,
    c,
    false,
  );
}

function finish(
  raw: RawRow[],
  format: 'csv' | 'json',
  declaredSource: string | null,
  c: IssueCollector,
  perRowIdentity: boolean,
): ValidationResult {
  if (raw.length > ANALYSIS_CONFIG.maxSamples) {
    c.error(null, null, tooManySamplesMessage(raw.length));
    return c.fail();
  }
  const samples: Array<AngleSample & { row: number }> = [];
  let identity: { joint: Joint; side: Side; movement: Movement } | null = null;
  let identityRow = 0;

  for (const r of raw) {
    let rowOk = true;
    // Identity fields (per row in CSV; once from the header in JSON).
    const jointRaw = typeof r.joint === 'string' ? r.joint.trim() : r.joint;
    const sideRaw = typeof r.side === 'string' ? r.side.trim() : r.side;
    const movementRaw = typeof r.movement === 'string' ? r.movement.trim() : r.movement;
    const idRow = perRowIdentity ? r.row : null;
    if (perRowIdentity || r === raw[0]) {
      if (jointRaw === '' || jointRaw === undefined || jointRaw === null) {
        c.error(idRow, 'joint', 'Joint is missing.');
        rowOk = false;
      } else if (!isJoint(jointRaw)) {
        c.error(idRow, 'joint', `Unknown joint "${String(jointRaw)}". Use one of: shoulder, elbow, wrist, hip, knee, ankle.`);
        rowOk = false;
      }
      if (sideRaw === '' || sideRaw === undefined || sideRaw === null) {
        c.error(idRow, 'side', 'Side is missing.');
        rowOk = false;
      } else if (!isSide(sideRaw)) {
        c.error(idRow, 'side', `Unknown side "${String(sideRaw)}". Use left or right.`);
        rowOk = false;
      }
      if (movementRaw === '' || movementRaw === undefined || movementRaw === null) {
        c.error(idRow, 'movement', 'Movement is missing.');
        rowOk = false;
      } else if (!isMovement(movementRaw)) {
        c.error(idRow, 'movement', `Unknown movement "${String(movementRaw)}".`);
        rowOk = false;
      } else if (isJoint(jointRaw) && !isMovementSupported(jointRaw, movementRaw)) {
        c.error(idRow, 'movement', `Movement "${movementRaw}" is not supported for the ${jointRaw}.`);
        rowOk = false;
      }
      if (rowOk && isJoint(jointRaw) && isSide(sideRaw) && isMovement(movementRaw)) {
        if (identity === null) {
          identity = { joint: jointRaw, side: sideRaw, movement: movementRaw };
          identityRow = r.row;
        } else if (identity.joint !== jointRaw || identity.side !== sideRaw || identity.movement !== movementRaw) {
          c.error(
            r.row,
            null,
            `All rows must describe one joint, side and movement. Row ${identityRow} is ${identity.side} ${identity.joint} ${identity.movement}, but this row is ${String(sideRaw)} ${String(jointRaw)} ${String(movementRaw)}.`,
          );
          rowOk = false;
        }
      }
      if (!perRowIdentity && !rowOk) return c.fail();
    }

    // Timestamp.
    let t: number | null = null;
    if (typeof r.timestamp !== 'string') {
      c.error(r.row, 'timestamp', r.timestamp === undefined || r.timestamp === null ? 'Timestamp is missing.' : 'Timestamp must be a string.');
      rowOk = false;
    } else {
      const parsed = parseIsoTimestamp(r.timestamp);
      if (parsed.ok) t = parsed.ms;
      else {
        c.error(r.row, 'timestamp', parsed.reason);
        rowOk = false;
      }
    }

    // Angle.
    const angle = parseAngle(r.angleDeg);
    if (!angle.ok) {
      c.error(r.row, 'angleDeg', angle.reason);
      rowOk = false;
    }

    if (rowOk && t !== null && angle.ok) samples.push({ t, angleDeg: angle.value, row: r.row });
  }

  if (c.hasErrors || identity === null) {
    if (identity === null && !c.hasErrors) c.error(null, null, 'No valid rows were found.');
    return c.fail();
  }

  if (samples.length < ANALYSIS_CONFIG.minSamples) {
    c.error(null, null, `At least ${ANALYSIS_CONFIG.minSamples} samples are required; the file has ${samples.length}.`);
    return c.fail();
  }

  // Ordering and duplicates — reported, never repaired.
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1] as AngleSample & { row: number };
    const cur = samples[i] as AngleSample & { row: number };
    if (cur.t === prev.t) {
      c.error(cur.row, 'timestamp', `Duplicate timestamp (same as row ${prev.row}).`);
    } else if (cur.t < prev.t) {
      c.error(cur.row, 'timestamp', `Timestamp is earlier than row ${prev.row}; samples must be in ascending time order.`);
    }
  }
  if (c.hasErrors) return c.fail();

  // Sampling intervals.
  const intervals: number[] = [];
  for (let i = 1; i < samples.length; i++) intervals.push((samples[i] as AngleSample).t - (samples[i - 1] as AngleSample).t);
  const med = median(intervals);
  if (med < ANALYSIS_CONFIG.minMedianIntervalMs || med > ANALYSIS_CONFIG.maxMedianIntervalMs) {
    c.error(
      null,
      'timestamp',
      `Median sampling interval is ${round(med, 3)} ms; it must be between ${ANALYSIS_CONFIG.minMedianIntervalMs} ms and ${ANALYSIS_CONFIG.maxMedianIntervalMs} ms (1–1000 Hz).`,
    );
    return c.fail();
  }
  let irregular = 0;
  intervals.forEach((dt, i) => {
    const row = (samples[i + 1] as { row: number }).row;
    if (dt > ANALYSIS_CONFIG.maxGapMultiple * med) {
      c.error(row, 'timestamp', `Gap of ${round(dt, 1)} ms before this row exceeds ${ANALYSIS_CONFIG.maxGapMultiple}× the median interval (${round(med, 1)} ms); data appear to be missing.`);
    }
    if (Math.abs(dt - med) > ANALYSIS_CONFIG.irregularTolerance * med) irregular++;
  });
  if (c.hasErrors) return c.fail();
  const irregularFraction = irregular / intervals.length;
  if (irregularFraction > ANALYSIS_CONFIG.maxIrregularFraction) {
    c.error(
      null,
      'timestamp',
      `${irregular} of ${intervals.length} sampling intervals (${round(irregularFraction * 100, 1)}%) deviate more than ${ANALYSIS_CONFIG.irregularTolerance * 100}% from the median; the limit is ${ANALYSIS_CONFIG.maxIrregularFraction * 100}%.`,
    );
    return c.fail();
  }
  if (irregular > 0) {
    c.warn(null, 'timestamp', `${irregular} sampling interval(s) deviate more than ${ANALYSIS_CONFIG.irregularTolerance * 100}% from the median interval. They are kept as recorded.`);
  }

  return {
    ok: true,
    recording: {
      ...identity,
      samples: samples.map(({ t, angleDeg }) => ({ t, angleDeg })),
      format,
      declaredSource,
    },
    warnings: c.warnings,
  };
}

function parseAngle(value: unknown): { ok: true; value: number } | { ok: false; reason: string } {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    const s = value.trim();
    if (s === '') return { ok: false, reason: 'Angle is missing.' };
    if (!NUMBER_RE.test(s)) return { ok: false, reason: `Angle "${s}" is not a number (degrees, without units).` };
    n = Number(s);
  } else if (value === undefined || value === null) {
    return { ok: false, reason: 'Angle is missing.' };
  } else {
    return { ok: false, reason: 'Angle must be a number.' };
  }
  if (!Number.isFinite(n)) return { ok: false, reason: 'Angle must be a finite number.' };
  if (n < ANALYSIS_CONFIG.minAngleDeg || n > ANALYSIS_CONFIG.maxAngleDeg) {
    return { ok: false, reason: `Angle ${n}° is outside the accepted range (${ANALYSIS_CONFIG.minAngleDeg}° to ${ANALYSIS_CONFIG.maxAngleDeg}°).` };
  }
  return { ok: true, value: n };
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === '');
}

function tooManySamplesMessage(n: number): string {
  return `The file has ${n.toLocaleString('en')} samples; the maximum is ${ANALYSIS_CONFIG.maxSamples.toLocaleString('en')}.`;
}

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

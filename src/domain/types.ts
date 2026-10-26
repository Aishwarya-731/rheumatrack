import type { Joint, Movement, Side } from './joints';

/** One timestamped angle sample. `t` is milliseconds since the Unix epoch (UTC). */
export interface AngleSample {
  t: number;
  angleDeg: number;
}

/**
 * Where a movement recording came from. The UI must always show this.
 * - `imported`   : a file supplied by the user from an external acquisition process.
 * - `simulation` : simulation-generated data (e.g. the MATLAB synthetic generator).
 * - `hardware`   : measured by a connected sensor. No hardware adapter exists yet, so the
 *                  application never creates records with this source.
 */
export type DataSource = 'imported' | 'simulation' | 'hardware';

export const DATA_SOURCE_LABEL: Record<DataSource, string> = {
  imported: 'Imported movement data',
  simulation: 'Simulation-generated data',
  hardware: 'Measured by connected sensor',
};

export interface IntervalStats {
  /** Milliseconds. */
  min: number;
  max: number;
  mean: number;
  median: number;
  sd: number;
  /** Nominal sampling rate derived from the median interval, Hz. */
  rateHz: number;
}

export interface QualityIndicators {
  /** Intervals deviating more than the tolerance from the median interval. */
  irregularIntervals: number;
  irregularIntervalPct: number;
}

export interface MovementMetrics {
  sampleCount: number;
  minDeg: number;
  maxDeg: number;
  /** Observed ROM = maxDeg − minDeg. Not a clinically validated ROM assessment. */
  romDeg: number;
  meanDeg: number;
  durationMs: number;
  interval: IntervalStats;
  quality: QualityIndicators;
  /** Completed cycles from the documented hysteresis algorithm, or null when not countable. */
  repetitions: number | null;
  repetitionNote: string | null;
}

export type CalibrationStatus = 'not-calibrated' | 'reference-available';

export interface MovementSession {
  id: string;
  ownerUid: string;
  joint: Joint;
  side: Side;
  movement: Movement;
  source: DataSource;
  /** True when the record is synthetic sample data created for development/demonstration. */
  isSynthetic: boolean;
  sourceFileName: string | null;
  sourceFormat: 'csv' | 'json' | 'generated';
  startedAt: number;
  endedAt: number;
  createdAt: number;
  metrics: MovementMetrics;
  calibrationId: string | null;
  calibrationStatus: CalibrationStatus;
  notes: string;
  chunkCount: number;
  schemaVersion: 1;
}

export interface SymptomAssessment {
  id: string;
  ownerUid: string;
  joint: Joint;
  side: Side;
  pain: number;
  stiffness: number;
  discomfort: number;
  /** Duration of stiffness or discomfort in minutes; null when not reported. */
  durationMinutes: number | null;
  notes: string;
  assessedAt: number;
  createdAt: number;
  updatedAt: number | null;
  isSynthetic: boolean;
  schemaVersion: 1;
}

export type CalibrationOutcome = 'completed' | 'failed' | 'cancelled';

export interface CalibrationRecord {
  id: string;
  ownerUid: string;
  joint: Joint;
  side: Side;
  movement: Movement;
  /** Calibration input source. Hardware is not available; only static reference files are. */
  inputSource: 'static-reference-file';
  sourceFileName: string;
  outcome: CalibrationOutcome;
  /** Mean angle of the static hold, degrees (only when completed). */
  referenceAngleDeg: number | null;
  /** Standard deviation during the hold, degrees. */
  holdSdDeg: number | null;
  holdDurationMs: number | null;
  sampleCount: number;
  validationMessages: string[];
  config: { maxHoldSdDeg: number; minHoldDurationMs: number; minSamples: number };
  createdAt: number;
  schemaVersion: 1;
}

export type Role = 'patient' | 'clinician';

export interface ReminderSettings {
  enabled: boolean;
  /** Local time "HH:mm" in `timezone`. */
  time: string;
  /** ISO weekday numbers, 1 = Monday … 7 = Sunday. */
  days: number[];
  timezone: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: number;
  reminders: ReminderSettings;
  preferredJoint: Joint | null;
  preferredSide: Side | null;
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked';

export interface ShareInvite {
  id: string;
  patientUid: string;
  patientName: string;
  clinicianEmail: string;
  status: InviteStatus;
  createdAt: number;
}

export interface ShareGrant {
  id: string;
  patientUid: string;
  clinicianUid: string;
  clinicianEmail: string;
  patientName: string;
  inviteId: string;
  createdAt: number;
}

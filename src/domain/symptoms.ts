import { isJoint, isSide, type Joint, type Side } from './joints';

/**
 * Symptom scoring (docs/SYMPTOM_SCALE.md).
 *
 * Pain, stiffness and discomfort are each self-rated on an 11-point numeric rating scale:
 * 0 = none, 10 = worst imaginable. Scores are recorded exactly as entered, in whole numbers.
 * They are not combined into a total, are not converted into a risk score, and carry no
 * diagnostic meaning.
 */

export const SCALE_MIN = 0;
export const SCALE_MAX = 10;
export const MAX_DURATION_MINUTES = 24 * 60;
export const MAX_NOTES_LENGTH = 2000;
/** Allowance for clock differences when checking that an assessment is not in the future. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const SCALE_ANCHORS: Record<number, string> = {
  0: 'None',
  5: 'Moderate',
  10: 'Worst imaginable',
};

export interface SymptomFormValues {
  joint: Joint | '';
  side: Side | '';
  pain: number;
  stiffness: number;
  discomfort: number;
  /** Raw text from the duration input; '' means not reported. */
  durationMinutes: string;
  notes: string;
  /** datetime-local value "YYYY-MM-DDTHH:mm" in the user's local time. */
  assessedAtLocal: string;
}

export type SymptomFormErrors = Partial<Record<keyof SymptomFormValues, string>>;

export interface ValidSymptomInput {
  joint: Joint;
  side: Side;
  pain: number;
  stiffness: number;
  discomfort: number;
  durationMinutes: number | null;
  notes: string;
  assessedAt: number;
}

function validScore(n: number): boolean {
  return Number.isInteger(n) && n >= SCALE_MIN && n <= SCALE_MAX;
}

export function parseLocalDateTime(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0, 0);
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date.getTime();
}

export function toLocalDateTimeInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function validateSymptomForm(
  values: SymptomFormValues,
  now: number = Date.now(),
): { ok: true; value: ValidSymptomInput } | { ok: false; errors: SymptomFormErrors } {
  const errors: SymptomFormErrors = {};
  if (!isJoint(values.joint)) errors.joint = 'Select a joint.';
  if (!isSide(values.side)) errors.side = 'Select left or right.';
  for (const key of ['pain', 'stiffness', 'discomfort'] as const) {
    if (!validScore(values[key])) errors[key] = `Enter a whole number from ${SCALE_MIN} to ${SCALE_MAX}.`;
  }
  let duration: number | null = null;
  const rawDuration = values.durationMinutes.trim();
  if (rawDuration !== '') {
    if (!/^\d+$/.test(rawDuration)) errors.durationMinutes = 'Enter the duration in whole minutes, or leave it empty.';
    else {
      duration = Number(rawDuration);
      if (duration > MAX_DURATION_MINUTES) errors.durationMinutes = `Duration cannot exceed ${MAX_DURATION_MINUTES} minutes (24 hours).`;
    }
  }
  if (values.notes.length > MAX_NOTES_LENGTH) errors.notes = `Notes are limited to ${MAX_NOTES_LENGTH} characters.`;
  const assessedAt = parseLocalDateTime(values.assessedAtLocal);
  if (assessedAt === null) errors.assessedAtLocal = 'Enter a valid date and time.';
  else if (assessedAt > now + FUTURE_TOLERANCE_MS) errors.assessedAtLocal = 'The assessment time cannot be in the future.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      joint: values.joint as Joint,
      side: values.side as Side,
      pain: values.pain,
      stiffness: values.stiffness,
      discomfort: values.discomfort,
      durationMinutes: duration,
      notes: values.notes.trim(),
      assessedAt: assessedAt as number,
    },
  };
}

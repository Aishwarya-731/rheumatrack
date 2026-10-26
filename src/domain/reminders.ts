import type { ReminderSettings } from './types';

/**
 * Check-in reminder scheduling (docs/REMINDERS.md).
 *
 * Delivery mechanisms that actually exist:
 *  1. In-app: while RheumaTrack is open, a banner appears when a scheduled check-in time has
 *     passed and no assessment has been saved since.
 *  2. Calendar: an .ics file with a weekly recurring event and an alarm, imported into the
 *     user's calendar app, which then delivers the reminder.
 * There is no server push; the UI states this.
 */

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  time: '09:00',
  days: [1, 2, 3, 4, 5, 6, 7],
  timezone: 'UTC',
};

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function validateReminderSettings(r: ReminderSettings): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) return 'Enter a time in 24-hour HH:MM format.';
  if (r.days.length === 0) return 'Select at least one day.';
  if (r.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return 'Days must be Monday to Sunday.';
  if (new Set(r.days).size !== r.days.length) return 'Days must not repeat.';
  if (!isValidTimeZone(r.timezone)) return 'Unknown timezone.';
  return null;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday 1 = Monday … 7 = Sunday. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(ms: number, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday ?? 'Mon'] ?? 1,
  };
}

/** Offset of `timeZone` from UTC at instant `ms`, in ms (e.g. +19 800 000 for Asia/Kolkata). */
export function timeZoneOffsetMs(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Converts a wall-clock time in `timeZone` to an epoch instant. */
export function zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = guess - timeZoneOffsetMs(guess, timeZone);
  const second = guess - timeZoneOffsetMs(first, timeZone);
  return second;
}

/** Scheduled occurrences between `from` and `to` (inclusive), ascending. */
export function occurrencesBetween(r: ReminderSettings, from: number, to: number): number[] {
  const [hh, mm] = r.time.split(':').map(Number) as [number, number];
  const out: number[] = [];
  // Walk calendar days in the reminder's timezone, with a day of margin either side.
  const start = from - 36 * 3600_000;
  for (let t = start; t <= to + 36 * 3600_000; t += 24 * 3600_000) {
    const p = zonedParts(t, r.timezone);
    const occ = zonedWallTimeToUtc(p.year, p.month, p.day, hh, mm, r.timezone);
    const weekday = zonedParts(occ, r.timezone).weekday;
    if (r.days.includes(weekday) && occ >= from && occ <= to && !out.includes(occ)) out.push(occ);
  }
  return out.sort((a, b) => a - b);
}

export function nextOccurrence(r: ReminderSettings, now: number): number | null {
  if (!r.enabled) return null;
  const occ = occurrencesBetween(r, now + 1, now + 8 * 24 * 3600_000);
  return occ[0] ?? null;
}

/**
 * The scheduled time that is currently due, if any: the latest occurrence in the past
 * 24 hours that is after the most recent assessment.
 */
export function dueOccurrence(r: ReminderSettings, now: number, lastAssessmentCreatedAt: number | null): number | null {
  if (!r.enabled) return null;
  const recent = occurrencesBetween(r, now - 24 * 3600_000, now);
  const latest = recent[recent.length - 1];
  if (latest === undefined) return null;
  if (lastAssessmentCreatedAt !== null && lastAssessmentCreatedAt >= latest) return null;
  return latest;
}

function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildReminderIcs(r: ReminderSettings, now: number = Date.now(), appUrl = ''): string {
  const first = nextOccurrence({ ...r, enabled: true }, now);
  if (first === null) throw new Error('No upcoming occurrence for this schedule');
  const p = zonedParts(first, r.timezone);
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${p.year}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}00`;
  const byday = [...r.days].sort((a, b) => a - b).map((d) => ICS_DAYS[d - 1]).join(',');
  const description = appUrl
    ? `Time to record a symptom check-in in RheumaTrack: ${appUrl}/symptoms/new`
    : 'Time to record a symptom check-in in RheumaTrack.';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RheumaTrack//Check-in reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:rheumatrack-checkin-${icsStamp(now)}@rheumatrack`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART;TZID=${r.timezone}:${local}`,
    'DURATION:PT5M',
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    'SUMMARY:RheumaTrack symptom check-in',
    `DESCRIPTION:${description.replace(/[,;]/g, (m) => `\\${m}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:RheumaTrack symptom check-in',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function describeSchedule(r: ReminderSettings): string {
  const days = [...r.days].sort((a, b) => a - b);
  const dayText =
    days.length === 7 ? 'every day' : days.join(',') === '1,2,3,4,5' ? 'on weekdays' : `on ${days.map((d) => WEEKDAY_LABELS[d - 1]).join(', ')}`;
  return `${r.time} ${dayText} (${r.timezone})`;
}

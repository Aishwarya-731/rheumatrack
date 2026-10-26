/**
 * Strict ISO-8601 timestamp parsing for movement samples.
 *
 * Accepted: YYYY-MM-DDTHH:mm:ss[.fff]Z  or  YYYY-MM-DDTHH:mm:ss[.fff]±HH:mm
 * - A timezone designator is required so timestamps are unambiguous.
 * - At most three fractional digits (millisecond precision); finer precision would be
 *   silently truncated by JavaScript dates, so it is rejected instead.
 * - Calendar values are checked (no 31 April, no hour 24).
 */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export type TimestampParse = { ok: true; ms: number } | { ok: false; reason: string };

export function parseIsoTimestamp(raw: string): TimestampParse {
  const value = raw.trim();
  if (value === '') return { ok: false, reason: 'Timestamp is missing.' };
  const m = ISO_RE.exec(value);
  if (!m) {
    if (/\.\d{4,}/.test(value)) {
      return { ok: false, reason: 'Timestamps must have at most millisecond precision (3 fractional digits).' };
    }
    return {
      ok: false,
      reason: 'Timestamp must be ISO 8601 with a timezone, e.g. 2026-10-26T10:00:00.000Z.',
    };
  }
  const [, ys, mos, ds, hs, mis, ss, fs, tz] = m;
  const year = Number(ys);
  const month = Number(mos);
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mis);
  const second = Number(ss);
  const millis = fs ? Number(fs.padEnd(3, '0')) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return { ok: false, reason: 'Timestamp contains an out-of-range date or time value.' };
  }
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return { ok: false, reason: 'Timestamp contains a date that does not exist.' };
  }
  let offsetMs = 0;
  if (tz && tz !== 'Z') {
    const sign = tz.startsWith('-') ? -1 : 1;
    const oh = Number(tz.slice(1, 3));
    const om = Number(tz.slice(4, 6));
    if (oh > 14 || om > 59) return { ok: false, reason: 'Timestamp has an invalid timezone offset.' };
    offsetMs = sign * (oh * 60 + om) * 60_000;
  }
  return { ok: true, ms: utc - offsetMs };
}

/** Format epoch ms as the canonical export form, always UTC with milliseconds. */
export function toIsoUtc(ms: number): string {
  return new Date(ms).toISOString();
}

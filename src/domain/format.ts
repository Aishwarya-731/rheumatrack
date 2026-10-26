/** Display formatting. Rounding happens here only, never in stored or exported values. */

export function fmtDeg(value: number | null | undefined, dp = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(dp)}°`;
}

export function fmtNumber(value: number | null | undefined, dp = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(dp);
}

export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m} min ${rem} s`;
}

export function fmtMinutes(min: number | null): string {
  if (min === null) return 'Not reported';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });

export function fmtDateTime(ms: number): string {
  return dateTimeFmt.format(ms);
}
export function fmtDate(ms: number): string {
  return dateFmt.format(ms);
}
export function fmtShortDate(ms: number): string {
  return shortDateFmt.format(ms);
}

export function fmtRelative(ms: number, now: number = Date.now()): string {
  const diff = now - ms;
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const suffix = diff >= 0 ? 'ago' : 'from now';
  if (abs < min) return 'just now';
  if (abs < hour) return `${Math.round(abs / min)} min ${suffix}`;
  if (abs < day) return `${Math.round(abs / hour)} h ${suffix}`;
  if (abs < 30 * day) return `${Math.round(abs / day)} d ${suffix}`;
  return fmtDate(ms);
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

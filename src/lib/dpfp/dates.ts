// All run dates are plain calendar dates ("YYYY-MM-DD"); handle them in UTC so the
// viewer's timezone never shifts a day.
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toUTC(date: string): Date {
  const [y = 1970, m = 1, d = 1] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** "Thu 12 Nov" */
export function fmtDay(date: string): string {
  const dt = toUTC(date);
  return `${WD[dt.getUTCDay()]} ${dt.getUTCDate()} ${MO[dt.getUTCMonth()]}`;
}

/** "12 Nov" */
export function fmtShort(date: string): string {
  const dt = toUTC(date);
  return `${dt.getUTCDate()} ${MO[dt.getUTCMonth()]}`;
}

/** "Thu 12 Nov 2026" */
export function fmtLong(date: string): string {
  return `${fmtDay(date)} ${toUTC(date).getUTCFullYear()}`;
}

/** "10 Nov 2026" */
export function fmtShortYear(date: string): string {
  return `${fmtShort(date)} ${toUTC(date).getUTCFullYear()}`;
}

export function monthName(i: number): string {
  return MO[i] ?? "";
}

export function weekdayIndexMon(date: string): number {
  // 0 = Monday … 6 = Sunday
  return (toUTC(date).getUTCDay() + 6) % 7;
}

/** Next 08:00 IST (02:30 UTC) strictly after `now`. */
export function nextUpdate(now: Date): Date {
  const t = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 30, 0),
  );
  if (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

/** "3h 12m" */
export function fmtCountdown(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** True when built_at is more than 30 hours before now. */
export function isDataLate(builtAt: string, now: Date): boolean {
  const t = new Date(builtAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > 30 * 3_600_000;
}

export function pct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

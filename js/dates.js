// Date helpers. All planner dates are local "floating" calendar dates (YYYY-MM-DD)
// interpreted in the user's home zone (America/Chicago) when exported.

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge weirdness
}
export function todayKey() { return toKey(new Date()); }
export function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
export function fromMonthKey(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1, 12);
}
export function addDays(key, n) {
  const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d);
}
export function addMonths(mk, n) {
  const d = fromMonthKey(mk); d.setMonth(d.getMonth() + n); return monthKey(d);
}
export function isWeekend(key) {
  const wd = fromKey(key).getDay();
  return wd === 0 || wd === 6;
}
export function weekday(key) { return fromKey(key).getDay(); }

/** Week containing key (weekStart 0=Sun, 1=Mon) -> [startKey, endKey] */
export function weekRange(key, weekStart = 0) {
  const start = addDays(key, -((weekday(key) - weekStart + 7) % 7));
  return [start, addDays(start, 6)];
}
export function monthRange(mk) {
  const d = fromMonthKey(mk);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
  return [toKey(d), toKey(last)];
}
export function eachDay(startKey, endKey) {
  const out = [];
  for (let k = startKey; k <= endKey; k = addDays(k, 1)) out.push(k);
  return out;
}

/** 6x7 (or 5x7) grid of keys for a month, starting on weekStart (0=Sun, 1=Mon). */
export function monthGrid(mk, weekStart = 0) {
  const first = fromMonthKey(mk);
  const start = addDays(toKey(first), -((first.getDay() - weekStart + 7) % 7));
  const [, lastKey] = monthRange(mk);
  const weeks = [];
  let k = start;
  while (weeks.length < 6) {
    const row = [];
    for (let i = 0; i < 7; i++) { row.push(k); k = addDays(k, 1); }
    weeks.push(row);
    if (k > lastKey) break;
  }
  return weeks;
}

/** "19:30" -> "7:30 pm" ; compact -> "7:30p" */
export function formatTime(hhmm, compact = false) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? (compact ? 'p' : ' pm') : (compact ? 'a' : ' am');
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 && compact ? `${h12}${suffix}` : `${h12}:${pad(m)}${suffix}`;
}
export function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
export function minutesToTime(min) {
  min = Math.max(0, Math.min(24 * 60 - 1, min));
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
export function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

/** Parse a loose time token: "7pm", "7:30", "19:00", "730p" -> "HH:MM" or null */
export function parseLooseTime(token) {
  const m = String(token).trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0); const ap = m[3];
  if (min > 59 || h > 23) return null;
  if (ap) { if (h > 12 || h === 0) return null; if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; }
  else if (!m[2] && h <= 12) return null; // bare "7" is too ambiguous
  return minutesToTime(h * 60 + min);
}

export function prettyDate(key, opts = {}) {
  const d = fromKey(key);
  const base = `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  return opts.year ? `${base}, ${d.getFullYear()}` : base;
}

/** A few well-known US dates, printed tiny in month cells like the paper planner. */
export function holidayFor(key) {
  const d = fromKey(key); const y = d.getFullYear(); const m = d.getMonth() + 1; const day = d.getDate();
  const nth = (month, wd, n) => { // nth weekday of month (n=-1 => last)
    if (n > 0) { const f = new Date(y, month - 1, 1).getDay(); return 1 + ((wd - f + 7) % 7) + (n - 1) * 7; }
    const last = new Date(y, month, 0); return last.getDate() - ((last.getDay() - wd + 7) % 7);
  };
  const fixed = { '1-1': "New Year's Day", '2-14': "Valentine's Day", '3-17': "St. Patrick's Day",
    '7-4': 'Independence Day', '10-31': 'Halloween', '11-11': 'Veterans Day',
    '12-24': 'Christmas Eve', '12-25': 'Christmas', '12-31': "New Year's Eve" };
  if (fixed[`${m}-${day}`]) return fixed[`${m}-${day}`];
  if (m === 5 && day === nth(5, 0, 2)) return "Mother's Day";
  if (m === 6 && day === nth(6, 0, 3)) return "Father's Day";
  if (m === 5 && day === nth(5, 1, -1)) return 'Memorial Day';
  if (m === 9 && day === nth(9, 1, 1)) return 'Labor Day';
  if (m === 10 && day === nth(10, 1, 2)) return "Indigenous Peoples' Day";
  if (m === 11 && day === nth(11, 4, 4)) return 'Thanksgiving';
  return null;
}

/** Day-of-week indexes in display order for a week start. */
export const weekOrder = (weekStart = 0) => Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

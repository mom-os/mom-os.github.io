// Minimal, standards-compliant iCalendar (RFC 5545) writer.
export const TZID = 'America/Chicago';

const VTIMEZONE_CHICAGO = [
  'BEGIN:VTIMEZONE',
  'TZID:America/Chicago',
  'X-LIC-LOCATION:America/Chicago',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0600',
  'TZOFFSETTO:-0500',
  'TZNAME:CDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0600',
  'TZNAME:CST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export function escapeText(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold to 75 octets per line (UTF-8 aware), continuation lines start with a space. */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = []; let cur = ''; let curLen = 0; let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (curLen + n > limit) { parts.push(cur); cur = ''; curLen = 0; limit = 74; }
    cur += ch; curLen += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const localStamp = (dateKey, hhmm) => `${dateKey.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
function utcStamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * events: normalised events from calendar/events.js
 * opts: { calName, alarmMinutes (0 = none) }
 */
export function buildICS(events, { calName = 'My Planner', alarmMinutes = 0 } = {}) {
  const now = utcStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JB Planner//Prototype 0.1//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE_CHICAGO,
  ];
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${TZID}:${localStamp(ev.date, ev.start)}`,
      `DTEND;TZID=${TZID}:${localStamp(ev.endDate || ev.date, ev.end)}`,
      `SUMMARY:${escapeText(ev.title)}`,
      `DESCRIPTION:${escapeText(ev.description || '')}`,
      `CATEGORIES:${escapeText(ev.category || 'Planner')}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'SEQUENCE:0',
    );
    if (alarmMinutes > 0) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(ev.title)}`,
        `TRIGGER:-PT${alarmMinutes}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

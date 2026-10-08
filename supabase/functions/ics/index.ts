// Public ICS feed authenticated by per-user calendar token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const TZID = 'America/Chicago';
const VTIMEZONE_CHICAGO = [
  'BEGIN:VTIMEZONE', 'TZID:America/Chicago', 'X-LIC-LOCATION:America/Chicago',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT',
  'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST',
  'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

function escapeText(s: string) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function foldLine(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = []; let cur = ''; let curLen = 0; let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (curLen + n > limit) { parts.push(cur); cur = ''; curLen = 0; limit = 74; }
    cur += ch; curLen += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
const localStamp = (dateKey: string, hhmm: string) => `${dateKey.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
function utcStamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function minutesToTime(m: number) {
  const h = Math.floor(m / 60), min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function buildICS(events: any[], calName = 'Mom.OS') {
  const now = utcStamp();
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mom.OS//Planner 0.3//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`, `X-WR-TIMEZONE:${TZID}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...VTIMEZONE_CHICAGO,
  ];
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT', `UID:${ev.uid}`, `DTSTAMP:${now}`,
      `DTSTART;TZID=${TZID}:${localStamp(ev.date, ev.start)}`,
      `DTEND;TZID=${TZID}:${localStamp(ev.endDate || ev.date, ev.end)}`,
      `SUMMARY:${escapeText(ev.title)}`,
      `DESCRIPTION:${escapeText(ev.description || '')}`,
      `CATEGORIES:${escapeText(ev.category || 'Planner')}`,
      'STATUS:CONFIRMED', 'TRANSP:OPAQUE',
      `SEQUENCE:${Number(ev.sequence) || 0}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function collectFromDays(rows: { day_date: string; doc: any }[], startKey: string, endKey: string) {
  const out: any[] = [];
  for (const row of rows) {
    const key = row.day_date;
    if (key < startKey || key > endKey) continue;
    const day = row.doc || {};
    for (const sec of day.sections || []) {
      for (const it of (sec.items || [])) {
        if (!(it.text || '').trim() || !it.time) continue;
        const startMin = timeToMinutes(it.time);
        const endAbs = startMin + (Number(sec.duration) || 30);
        const endDate = endAbs >= 1440 ? addDays(key, 1) : key;
        const title = it.label ? `${it.label}: ${it.text.trim()}` : it.text.trim();
        const seq = day.updatedAt ? Math.max(0, Math.floor(new Date(day.updatedAt).getTime() / 1000) % 100000) : 0;
        out.push({
          uid: `${it.id}@momos`,
          date: key, start: it.time, endDate, end: minutesToTime(endAbs % 1440),
          title, category: sec.title,
          description: `${sec.title}${it.done ? ' (done)' : ''} · Mom.OS`,
          sequence: seq,
        });
      }
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

function cors(req: Request) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || url.pathname.split('/').filter(Boolean).pop();
    if (!token || token === 'ics') {
      return new Response('Missing token', { status: 400, headers: cors(req) });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tok, error: tokErr } = await supabase
      .from('calendar_tokens').select('user_id').eq('token', token).maybeSingle();
    if (tokErr) throw tokErr;
    if (!tok) return new Response('Not found', { status: 404, headers: cors(req) });

    const today = new Date();
    const start = new Date(today); start.setDate(start.getDate() - 30);
    const end = new Date(today); end.setDate(end.getDate() + 180);
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);

    const { data: days, error } = await supabase
      .from('days')
      .select('day_date, doc')
      .eq('user_id', tok.user_id)
      .gte('day_date', startKey)
      .lte('day_date', endKey);
    if (error) throw error;

    const events = collectFromDays(days || [], startKey, endKey);
    const ics = buildICS(events, 'Mom.OS');
    return new Response(ics, {
      headers: {
        ...cors(req),
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="momos.ics"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e) {
    console.error(e);
    return new Response('Server error', { status: 500, headers: cors(req) });
  }
});

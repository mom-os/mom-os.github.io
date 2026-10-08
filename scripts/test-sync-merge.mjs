import { newer, mergeDayMaps, mergeDoc, mergeMonthNotes } from '../js/sync/merge.js';
import { buildICS, foldLine, escapeText } from '../js/calendar/ics.js';
import { collectEvents } from '../js/calendar/events.js';

let failed = 0;
const assert = (cond, msg) => { if (!cond) { console.error('FAIL', msg); failed++; } else console.log('ok', msg); };

assert(newer('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z') > 0, 'newer a>b');
assert(newer(null, '2026-01-01T00:00:00Z') < 0, 'missing local loses');

const { days } = mergeDayMaps(
  { '2026-10-08': { id: 'l', updatedAt: '2026-10-08T12:00:00Z', text: 'local' } },
  { '2026-10-08': { id: 'r', updatedAt: '2026-10-08T13:00:00Z', text: 'remote' },
    '2026-10-09': { id: 'n', updatedAt: '2026-10-09T10:00:00Z' } },
);
assert(days['2026-10-08'].text === 'remote', 'LWW picks remote day');
assert(days['2026-10-09'].id === 'n', 'remote-only day kept');

const m = mergeDoc({ updatedAt: '2026-10-08T14:00:00Z', v: 1 }, { updatedAt: '2026-10-08T13:00:00Z', v: 2 });
assert(m.winner === 'local' && m.doc.v === 1, 'settings LWW local');

const notes = mergeMonthNotes(
  { '2026-10': { items: [{ id: 1 }], updatedAt: '2026-10-01T00:00:00Z' } },
  { '2026-10': { items: [{ id: 2 }], updatedAt: '2026-10-02T00:00:00Z' } },
);
assert(notes['2026-10'].items[0].id === 2, 'month notes LWW');

const ics = buildICS([{
  uid: 'item1@momos', date: '2026-10-08', start: '07:30', endDate: '2026-10-08', end: '08:00',
  title: 'Work starts', description: 'Test', category: 'Todo', sequence: 3,
}], { calName: 'Mom.OS' });
assert(ics.includes('BEGIN:VCALENDAR'), 'ics calendar');
assert(ics.includes('UID:item1@momos'), 'stable uid');
assert(ics.includes('TZID:America/Chicago'), 'chicago tz');
assert(ics.includes('REFRESH-INTERVAL'), 'refresh hint');
assert(ics.includes('X-PUBLISHED-TTL'), 'ttl hint');
assert(ics.includes('SEQUENCE:3'), 'sequence');
assert(!ics.split('\r\n').some((l) => l && !l.startsWith(' ') && new TextEncoder().encode(l).length > 75), 'lines folded');

// fake store for collectEvents
const store = {
  hasDay: (k) => k === '2026-10-08',
  getDay: () => ({
    sections: [{ id: 's1', title: 'Todo', duration: 30, color: 'teal', items: [
      { id: 'i1', text: 'Call', time: '09:00', done: false },
      { id: 'i2', text: '  ', time: '10:00' },
    ] }],
  }),
};
const ev = collectEvents(store, '2026-10-01', '2026-10-31');
assert(ev.length === 1 && ev[0].uid.endsWith('@momos'), 'collectEvents uid');

if (failed) { console.error(failed, 'failed'); process.exit(1); }
console.log('ALL PASS');

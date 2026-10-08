import { instantiate, makeItem, makeList } from './templates.js';
import { uid } from './util.js';

// Clearly-fake example content so the design can be judged. Every seeded
// line carries `sample: true` and every seeded day `sample: true`.
const SAMPLE = {
  '2026-10-08': { // Thursday (weekday template)
    issues: [
      ['Finish brochure mockups for Acme Co. (example)', null, true],
      ['Call pediatrician re: flu shots (example)', null, false],
      ['List 5 new resale items (example)', null, false],
    ],
    meals: { Dinner: ['Sheet-pan chicken fajitas (example)', '17:45'] },
    todo: [
      ['Work starts - check messages (example)', '07:30', true],
      ['Lunch walk around the block (example)', '12:15', false],
      ['Client review call - Acme Co. (example)', '14:00', false],
      ['Grocery pickup order (example)', '17:15', false],
      ['Toddler bath + bedtime stories (example)', '19:00', false, 'p:duck'],
      ['Pack 3 resale orders (example)', '20:15', false, 'p:box'],
    ],
    stickers: ['p:coffee'], secStickers: { issues: 'p:sparkle' },
    notes: 'Example note: ask about daycare picture day.\nExample: pick up printer ink.',
    lists: [
      { title: 'Grocery pickup', color: 'sage', items: [
        ['Milk (example)', true], ['Bananas (example)', true], ['Tortillas (example)', false], ['Salsa (example)', false],
      ]},
      { title: 'Kid stuff to pack', color: 'butter', items: [
        ['Spare clothes (example)', false], ['Snack cup (example)', false],
      ]},
    ],
    reflection: { wentWell: 'Got the brochure mockups out the door (example).', carryOver: 'Still need flu-shot call (example).', focus: 'Ship the three resale orders (example).' },
  },
  '2026-10-10': { // Saturday (weekend template)
    issues: [
      ['Edit gallery from last session (example)', null, false],
      ['Restock resale bins (example)', null, false],
    ],
    meals: {
      Breakfast: ['Banana pancakes (example)', '08:00'],
      Lunch: ['Turkey wraps + fruit (example)', '12:00'],
      Dinner: ['Homemade pizza night (example)', '17:30'],
      Snack: ['Apple slices & PB (example)', null],
    },
    todo: [
      ['Farmers market with the kids (example)', '09:00', true],
      ['Nap time: ship weekend orders (example)', '13:30', false],
      ['Date night - book sitter (example)', '18:30', false],
    ],
    sessions: [
      ['Boudoir session - "Client A" (example)', '10:30', false, 'e:📸'],
      ['Mini session - "Client B" (example)', '15:00', false],
    ],
    stickers: ['p:sun', 'p:camera'], secStickers: { sessions: 'p:camera', meals: 'p:heart' },
    notes: 'Example: charge camera batteries Friday night.',
    lists: [
      { title: 'Session shot list', color: 'lavender', items: [
        ['Wide establishing (example)', false], ['Detail: rings / details (example)', false], ['Candids between poses (example)', false],
      ]},
    ],
  },
};

export function seedSample(store) {
  for (const [key, data] of Object.entries(SAMPLE)) {
    const day = instantiate(store.templates, key);
    day.sample = true;
    day.notes = data.notes || '';
    day.notesSample = true;
    if (data.stickers) day.stickers = [...data.stickers];
    for (const sec of day.sections) {
      if (data.secStickers?.[sec.role]) sec.sticker = data.secStickers[sec.role];
      const rows = data[sec.role];
      if (!rows) continue;
      if (sec.role === 'meals') {
        for (const it of sec.items) {
          const v = rows[it.label];
          if (v) Object.assign(it, { text: v[0], time: v[1], sample: true });
        }
      } else {
        sec.items.push(...rows.map(([text, time, done, sticker]) => makeItem({ text, time, done, sample: true, ...(sticker ? { sticker } : {}) })));
      }
    }
    if (data.lists) {
      day.lists = data.lists.map((L) => makeList({
        title: L.title, color: L.color,
        items: L.items.map(([text, done]) => ({ text, done: !!done, sample: true })),
      }));
      for (const L of day.lists) for (const it of L.items) it.sample = true;
    }
    if (data.reflection) day.reflection = { ...data.reflection };
    // Sample reminder on the grocery pickup timed line (Oct 8)
    if (key === '2026-10-08') {
      for (const sec of day.sections) {
        for (const it of sec.items) {
          if ((it.text || '').includes('Grocery pickup') && it.time) {
            it.alarm = { enabled: true, offsetMinutes: 15 };
          }
        }
      }
    }
    store.state.days[key] = day;
    store.virtual.delete(key);
  }
  store.state.monthNotes['2026-10'] = [
    { id: uid('mn'), text: 'Halloween costumes by 10/24 (example)', sample: true },
    { id: uid('mn'), text: 'Book fall mini-session dates (example)', sample: true },
    { id: uid('mn'), text: 'Resale: list winter coats (example)', sample: true },
  ];
  store.state.meta.seeded = true;
  store.state.meta.sampleActive = true;
  store.commit('seed');
}

export function clearSample(store) {
  const s = store.state;
  for (const [key, day] of Object.entries(s.days)) {
    for (const sec of day.sections) {
      for (const it of sec.items) {
        if (!it.sample) continue;
        if (it.label) { it.text = ''; it.time = null; it.done = false; delete it.sample; }
        else it._drop = true;
      }
      sec.items = sec.items.filter((i) => !i._drop);
    }
    if (day.notesSample) { day.notes = ''; delete day.notesSample; }
    if (Array.isArray(day.lists)) {
      for (const L of day.lists) L.items = L.items.filter((i) => !i.sample);
      day.lists = day.lists.filter((L) => L.items.length);
    }
    const hasReal = day.sections.some((sec) => sec.items.some((i) => (i.text || '').trim())) || (day.notes || '').trim() || (day.lists || []).length;
    if (day.sample && !hasReal) delete s.days[key];
  }
  for (const mk of Object.keys(s.monthNotes)) s.monthNotes[mk] = s.monthNotes[mk].filter((n) => !n.sample);
  s.meta.sampleActive = false;
  store.virtual.clear();
  store.commit('clearSample');
}

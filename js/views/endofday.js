import { addDays, todayKey, fromKey, DAY_NAMES, MONTH_NAMES, formatTime, timeToMinutes } from '../dates.js';
import { filled, dayStats } from '../store.js';
import { makeItem, makeListItem } from '../templates.js';
import { icon, confirmSheet } from '../ui.js';
import { esc } from '../util.js';
import { quoteFor } from './shared.js';

export function renderEndOfDay(view, ctx, arg) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : ctx.focusDate || todayKey();
  ctx.focusDate = key;
  const day = ctx.store.getDay(key);
  const d = fromKey(key);
  const isToday = key === todayKey();
  const { done, total } = dayStats(day);
  const reflection = day.reflection || { wentWell: '', carryOver: '', focus: '' };
  const lists = day.lists || [];

  const timed = [];
  for (const sec of day.sections) {
    for (const it of filled(sec.items)) {
      if (it.time) timed.push({ sec, it });
    }
  }
  timed.sort((a, b) => (timeToMinutes(a.it.time) ?? 9999) - (timeToMinutes(b.it.time) ?? 9999));

  const sectionsHTML = day.sections.map((sec) => {
    const items = filled(sec.items);
    if (!items.length) return '';
    const doneN = items.filter((i) => i.done).length;
    return `<section class="eod-sec c-${sec.color}">
      <h3><span class="eod-dot"></span>${esc(sec.title)} <span class="sec-count ${doneN === items.length ? 'all' : ''}">${doneN}/${items.length}</span></h3>
      <ul>${items.map((it) => `<li class="${it.done ? 'done' : ''}">
        <span class="eod-check">${it.done ? icon.check : ''}</span>
        ${it.time ? `<span class="eod-time">${formatTime(it.time, true)}</span>` : ''}
        ${it.label ? `<b>${esc(it.label)}:</b> ` : ''}${esc(it.text)}
      </li>`).join('')}</ul>
    </section>`;
  }).join('');

  const listsHTML = lists.length ? lists.map((L) => {
    const items = L.items.filter((i) => (i.text || '').trim());
    const doneN = items.filter((i) => i.done).length;
    return `<section class="eod-sec c-${L.color}">
      <h3><span class="eod-dot"></span>${esc(L.title)} <span class="eod-badge">list</span> <span class="sec-count ${items.length && doneN === items.length ? 'all' : ''}">${doneN}/${items.length}</span></h3>
      ${items.length ? `<ul>${items.map((it) => `<li class="${it.done ? 'done' : ''}"><span class="eod-check">${it.done ? icon.check : ''}</span>${esc(it.text)}</li>`).join('')}</ul>` : '<p class="empty">Empty list</p>'}
    </section>`;
  }).join('') : '';

  const uncheckedCount = countUnchecked(day);

  view.innerHTML = `
  <section class="eod-view">
    <div class="view-head no-print">
      <div class="nav-group">
        <button class="icon-btn" data-nav="-1" aria-label="Previous day">${icon.left}</button>
        <button class="btn small ghost" data-nav="today">Today</button>
        <button class="icon-btn" data-nav="1" aria-label="Next day">${icon.right}</button>
      </div>
      <div class="head-actions">
        <a class="btn small" href="#/day/${key}">Day</a>
        <a class="btn small" href="#/lists/${key}">Lists</a>
        <button class="btn small" data-act="print">${icon.cal}<span>Print</span></button>
        <button class="btn small primary" data-act="carry" ${uncheckedCount ? '' : 'disabled'}>Carry unchecked${uncheckedCount ? ` (${uncheckedCount})` : ''}</button>
      </div>
    </div>
    <div class="eod-sheet paper">
      <header class="eod-hero">
        <div>
          <p class="script-title">End of day</p>
          <h1 class="md-date">${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${isToday ? ' <span class="today-pill">today</span>' : ''}</h1>
          <p class="script-quote">${esc(quoteFor(ctx, key))}</p>
        </div>
        <div class="eod-progress" title="${done} of ${total} done">
          <div class="eod-ring">${ring(done, total)}</div>
          <span><b>${done}</b> of ${total} done</span>
        </div>
      </header>

      ${timed.length ? `<section class="eod-block">
        <h2 class="md-h">Timeline</h2>
        <ol class="eod-timeline">${timed.map(({ sec, it }) => `<li class="${it.done ? 'done' : ''} c-${sec.color}">
          <span class="eod-time">${formatTime(it.time, true)}</span>
          <span class="eod-check">${it.done ? icon.check : ''}</span>
          <span>${it.label ? `<b>${esc(it.label)}:</b> ` : ''}${esc(it.text)} <em class="eod-sec-tag">${esc(sec.title)}</em></span>
        </li>`).join('')}</ol>
      </section>` : ''}

      <section class="eod-block">
        <h2 class="md-h">Sections</h2>
        ${sectionsHTML || '<p class="empty">No planned items today.</p>'}
      </section>

      ${lists.length ? `<section class="eod-block">
        <h2 class="md-h">Lists</h2>
        ${listsHTML}
      </section>` : ''}

      ${(day.notes || '').trim() ? `<section class="eod-block">
        <h2 class="md-h">Notes</h2>
        <div class="eod-notes">${esc(day.notes).replace(/\n/g, '<br>')}</div>
      </section>` : ''}

      <section class="eod-block eod-reflect">
        <h2 class="md-h">Reflection</h2>
        <label class="eod-field"><span>What went well</span>
          <textarea data-fid="ref-went" data-ref="wentWell" rows="2" placeholder="A small win counts…">${esc(reflection.wentWell)}</textarea>
        </label>
        <label class="eod-field"><span>What to carry over</span>
          <textarea data-fid="ref-carry" data-ref="carryOver" rows="2" placeholder="Unfinished thoughts…">${esc(reflection.carryOver)}</textarea>
        </label>
        <label class="eod-field"><span>Tomorrow's one focus</span>
          <textarea data-fid="ref-focus" data-ref="focus" rows="2" placeholder="Just one thing…">${esc(reflection.focus)}</textarea>
        </label>
      </section>
    </div>
  </section>`;

  bindEod(view, ctx, key);
}

function ring(done, total) {
  const r = 18, c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const dash = `${(pct * c).toFixed(1)} ${c.toFixed(1)}`;
  return `<svg viewBox="0 0 44 44" class="progress-ring" aria-hidden="true">
    <circle cx="22" cy="22" r="${r}" fill="none" stroke="currentColor" stroke-width="4" opacity=".15"/>
    <circle cx="22" cy="22" r="${r}" fill="none" stroke="currentColor" stroke-width="4"
      stroke-dasharray="${dash}" stroke-linecap="round" transform="rotate(-90 22 22)"/>
  </svg>`;
}

function countUnchecked(day) {
  let n = 0;
  for (const sec of day.sections) for (const it of filled(sec.items)) if (!it.done) n++;
  for (const L of day.lists || []) for (const it of L.items) if ((it.text || '').trim() && !it.done) n++;
  return n;
}

function bindEod(view, ctx, key) {
  const { store } = ctx;

  view.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act],[data-nav]');
    if (!el) return;
    if (el.dataset.nav) {
      const n = el.dataset.nav;
      const next = n === 'today' ? todayKey() : addDays(key, Number(n));
      ctx.focusDate = next;
      return ctx.go(`#/eod/${next}`);
    }
    if (el.dataset.act === 'print') {
      window.print();
      return;
    }
    if (el.dataset.act === 'carry') {
      const day = store.getDay(key);
      const n = countUnchecked(day);
      if (!n) return;
      const ok = await confirmSheet(el, `Copy ${n} unchecked item${n === 1 ? '' : 's'} to tomorrow?`, 'Carry over');
      if (!ok) return;
      carryUnchecked(store, key);
      ctx.toast(`Carried ${n} item${n === 1 ? '' : 's'} to tomorrow`, {
        action: { label: 'Open tomorrow', fn: () => { ctx.focusDate = addDays(key, 1); ctx.go(`#/day/${addDays(key, 1)}`); } },
      });
    }
  });

  view.addEventListener('input', (e) => {
    const t = e.target.closest('[data-ref]');
    if (!t) return;
    const field = t.dataset.ref;
    store.mutateDay(key, (d) => {
      d.reflection = d.reflection || { wentWell: '', carryOver: '', focus: '' };
      d.reflection[field] = t.value;
    }, { silent: true });
  });

  view.addEventListener('change', (e) => {
    if (e.target.closest('[data-ref]')) store.commit('day');
  });
}

/** Copy unfinished section items (by role match / title) and list items onto tomorrow. */
export function carryUnchecked(store, fromKey) {
  const from = store.getDay(fromKey);
  const toKey = addDays(fromKey, 1);

  store.mutateDay(toKey, (to) => {
    // sections: match by role, else by title
    for (const sec of from.sections) {
      const unfinished = filled(sec.items).filter((i) => !i.done);
      if (!unfinished.length) continue;
      let dest = to.sections.find((s) => s.role && s.role === sec.role && s.role !== 'custom');
      if (!dest) dest = to.sections.find((s) => s.title === sec.title);
      if (!dest) {
        dest = {
          id: sec.id + '_carry',
          title: sec.title,
          subtitle: sec.subtitle || '',
          color: sec.color,
          role: sec.role || 'custom',
          duration: sec.duration,
          items: [],
        };
        to.sections.push(dest);
      }
      for (const it of unfinished) {
        dest.items.push(makeItem({
          text: it.text,
          label: it.label || '',
          time: it.time || null,
          done: false,
          sticker: it.sticker || null,
        }));
      }
    }

    // lists: match by title, else create
    for (const L of from.lists || []) {
      const unfinished = L.items.filter((i) => (i.text || '').trim() && !i.done);
      if (!unfinished.length) continue;
      let dest = (to.lists || []).find((x) => x.title === L.title);
      if (!dest) {
        dest = { id: L.id + '_carry', title: L.title, color: L.color, items: [], createdAt: Date.now() };
        to.lists = to.lists || [];
        to.lists.push(dest);
      }
      for (const it of unfinished) {
        dest.items.push(makeListItem({ text: it.text, done: false }));
      }
    }

    // reflection carry-over hint
    if ((from.reflection?.carryOver || '').trim()) {
      to.reflection = to.reflection || { wentWell: '', carryOver: '', focus: '' };
      const note = from.reflection.carryOver.trim();
      if (!(to.notes || '').includes(note)) {
        to.notes = [(to.notes || '').trim(), note].filter(Boolean).join('\n\n');
      }
    }
    if ((from.reflection?.focus || '').trim()) {
      to.reflection = to.reflection || { wentWell: '', carryOver: '', focus: '' };
      if (!(to.reflection.focus || '').trim()) to.reflection.focus = from.reflection.focus.trim();
    }
  });
}

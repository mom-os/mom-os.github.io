import { addDays, todayKey, fromKey, isWeekend, DAY_NAMES, MONTH_NAMES, formatTime, timeToMinutes, nowMinutes, parseLooseTime } from '../dates.js';
import { filled, dayStats } from '../store.js';
import { makeItem, sectionFromBlueprint } from '../templates.js';
import { icon } from '../ui.js';
import { esc } from '../util.js';
import { quoteFor } from './shared.js';
import { stickerHTML } from '../style/stickers.js';
import { openExport } from './export.js';

const TIME_RX = /(?:^|\s)(?:at\s+|@\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)|\d{1,2}:\d{2})(?=\s|$)/i;

/** "call mom 7pm" -> { text:'call mom', time:'19:00' } */
export function parseQuickAdd(raw) {
  const m = raw.match(TIME_RX);
  if (!m) return { text: raw.trim(), time: null };
  const time = parseLooseTime(m[1]);
  if (!time) return { text: raw.trim(), time: null };
  return { text: (raw.slice(0, m.index) + ' ' + raw.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(), time };
}

function ring(done, total) {
  const pct = total ? done / total : 0; const r = 26; const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-bg"/>
    <circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 32 32)"/></svg>`;
}

export function renderMyDay(view, ctx, arg) {
  const { store } = ctx;
  const key = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : ctx.focusDate;
  const day = store.getDay(key);
  const d = fromKey(key);
  const isToday = key === todayKey();
  const kind = isWeekend(key) ? 'weekend' : 'weekday';
  const anchors = store.settings.showAnchors ? (store.settings.anchors[kind] || []) : [];
  const { done, total } = dayStats(day);

  const timed = [];
  const groups = [];
  for (const s of day.sections) {
    const untimed = [];
    for (const it of filled(s.items)) (it.time ? timed : untimed).push({ s, it });
    if (untimed.length) groups.push({ s, items: untimed });
  }
  for (const a of anchors) timed.push({ anchor: a, it: { time: a.time } });
  timed.sort((x, y) => timeToMinutes(x.it.time) - timeToMinutes(y.it.time) || (x.anchor ? -1 : 1));

  const now = nowMinutes();
  const realTimed = timed.filter((t) => !t.anchor);
  const next = realTimed.find((t) => !t.it.done && (!isToday || timeToMinutes(t.it.time) >= now - 15))
    || (isToday ? null : realTimed.find((t) => !t.it.done));

  let nowPlaced = !isToday;
  const rows = [];
  for (const t of timed) {
    if (!nowPlaced && timeToMinutes(t.it.time) > now) { rows.push(`<li class="now-line"><span>Now · ${formatTime(`${String(Math.floor(now / 60)).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`, true)}</span></li>`); nowPlaced = true; }
    if (t.anchor) {
      rows.push(`<li class="md-row anchor-row"><span class="md-time">${formatTime(t.anchor.time, true)}</span><span class="md-anchor-dot"></span>
        <span class="md-text">${esc(t.anchor.text)}${t.anchor.end ? ` <small>until ${formatTime(t.anchor.end, true)}</small>` : ''}</span></li>`);
    } else {
      const { s, it } = t; const isNext = next && next.it.id === it.id;
      rows.push(`<li class="md-row c-${s.color} ${it.done ? 'done' : ''} ${isNext ? 'next' : ''}" data-item="${it.id}">
        <span class="md-time">${formatTime(it.time, true)}</span>
        <button class="check" data-act="toggle" role="checkbox" aria-checked="${!!it.done}" aria-label="Done">${icon.check}</button>
        <span class="md-text">${stickerHTML(it.sticker, 'stk-line')}${it.label ? `<b>${esc(it.label)}:</b> ` : ''}${esc(it.text)}</span>
        <span class="chip-sec c-${s.color}">${esc(s.title)}</span></li>`);
    }
  }
  if (!nowPlaced) rows.push(`<li class="now-line"><span>Now</span></li>`);

  const groupHTML = groups.map(({ s, items }) => `
    <div class="md-group c-${s.color}">
      <h3>${s.sticker ? stickerHTML(s.sticker, 'stk-sec') : `<span class="dot c-${s.color}"></span>`}${esc(s.title)}</h3>
      <ul>${items.map(({ it }) => `<li class="md-row ${it.done ? 'done' : ''}" data-item="${it.id}">
        <button class="check" data-act="toggle" role="checkbox" aria-checked="${!!it.done}" aria-label="Done">${icon.check}</button>
        <span class="md-text">${stickerHTML(it.sticker, 'stk-line')}${it.label ? `<b>${esc(it.label)}:</b> ` : ''}${esc(it.text)}</span></li>`).join('')}</ul>
    </div>`).join('');

  const allDone = total > 0 && done === total;
  view.innerHTML = `
  <section class="myday-view">
    <div class="view-head">
      <div class="nav-group">
        <button class="icon-btn" data-nav="-1" aria-label="Previous day">${icon.left}</button>
        <button class="btn small ghost" data-nav="today">Today</button>
        <button class="icon-btn" data-nav="1" aria-label="Next day">${icon.right}</button>
      </div>
      <div class="head-actions">
        <a class="btn small" href="#/day/${key}">Edit day</a>
        <button class="btn small" data-act="export">${icon.cal}<span>Export</span></button>
      </div>
    </div>
    <div class="md-layout paper">
      <div class="md-main">
        <header class="md-hero">
          <div>
            <p class="script-title">My Day ${(day.stickers || []).map((v) => stickerHTML(v, 'stk-title')).join('')}</p>
            <h1 class="md-date">${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${isToday ? ' <span class="today-pill">today</span>' : ''}</h1>
          </div>
          <div class="md-progress" title="${done} of ${total} done">${ring(done, total)}<span><b>${done}</b>/${total}</span></div>
        </header>
        ${allDone ? `<div class="celebrate">${icon.spark}<div><b>All done. Look at you go!</b><span>Rest is productive too.</span></div></div>`
          : next ? `<div class="next-up c-${next.s.color}"><span class="nu-label">Next up</span><span class="nu-time">${formatTime(next.it.time)}</span><span class="nu-text">${esc(next.it.label ? next.it.label + ': ' : '')}${esc(next.it.text)}</span></div>` : ''}
        <form class="quick-add" autocomplete="off">
          <input name="q" data-fid="quick-add" placeholder="Add something… try “call mom 7pm”" aria-label="Quick add" enterkeyhint="done">
          <button class="btn primary" aria-label="Add">${icon.plus}</button>
        </form>
        <h2 class="md-h">Timeline</h2>
        ${realTimed.length || anchors.length ? `<ol class="timeline">${rows.join('')}</ol>` : '<p class="empty">No timed things yet. Give a line a time and it lands here in order.</p>'}
      </div>
      <aside class="md-side">
        <h2 class="md-h">Anytime today</h2>
        ${groupHTML || '<p class="empty">Nothing untimed. Nice and tidy.</p>'}
        <p class="script-quote">${esc(quoteFor(ctx, key))}</p>
      </aside>
    </div>
  </section>`;

  view.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act],[data-nav]'); if (!el) return;
    if (el.dataset.nav) { const n = el.dataset.nav; const nk = n === 'today' ? todayKey() : addDays(key, Number(n)); ctx.focusDate = nk; return ctx.go(`#/myday/${nk}`); }
    if (el.dataset.act === 'export') return openExport(el, ctx, key, 'day');
    if (el.dataset.act === 'toggle') {
      const id = el.closest('[data-item]').dataset.item;
      store.mutateDay(key, (dd) => { for (const s of dd.sections) { const it = s.items.find((i) => i.id === id); if (it) it.done = !it.done; } });
    }
  });
  view.querySelector('.quick-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = e.target.q; const raw = inp.value.trim(); if (!raw) return;
    const { text, time } = parseQuickAdd(raw);
    let target = '';
    store.mutateDay(key, (dd) => {
      const want = time ? ['todo', 'sessions'] : ['issues'];
      let sec = dd.sections.find((s) => s.role === want[0]) || dd.sections.find((s) => want.includes(s.role)) || dd.sections[0];
      if (!sec) { sec = sectionFromBlueprint({ title: 'To Do', color: 'teal', role: 'todo', slots: [] }); dd.sections.push(sec); }
      sec.items.push(makeItem({ text: text || raw, time })); target = sec.title;
    });
    ctx.toast(time ? `Added to ${target} at ${formatTime(time, true)}` : `Added to ${target}`);
    ctx.pendingFocus = 'quick-add'; ctx.rerender();
  });
}

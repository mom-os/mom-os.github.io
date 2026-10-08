import { addDays, todayKey, fromKey, isWeekend, DAY_NAMES, MONTH_NAMES, formatTime, monthGrid, monthKey, timeToMinutes, weekOrder, minutesToTime } from '../dates.js';
import { stickerHTML } from '../style/stickers.js';
import { openStickerPicker } from '../style/sticker-picker.js';
import { filled } from '../store.js';
import { PALETTE, makeItem, blueprintFromDay, sectionFromBlueprint } from '../templates.js';
import { icon, openPopover, closePopover } from '../ui.js';
import { esc } from '../util.js';
import { quoteFor } from './shared.js';
import { openExport } from './export.js';

const TIME_CHIPS = [['07:00', '7a'], ['09:00', '9a'], ['12:00', 'Noon'], ['15:00', '3p'], ['17:30', '5:30p'], ['19:30', '7:30p'], ['20:30', '8:30p']];

export function lineHTML(sec, it, opts = {}) {
  const timedRole = sec.role === 'todo' || sec.role === 'sessions';
  const time = it.time
    ? `<button class="time-pill set" data-act="time" aria-label="Change time">${formatTime(it.time, true)}</button>`
    : timedRole ? `<button class="time-pill empty" data-act="time" aria-label="Add time">${icon.clock}<span>time</span></button>` : '';
  return `<li class="line ${it.done ? 'done' : ''}" data-item="${it.id}">
    <button class="check" data-act="toggle" role="checkbox" aria-checked="${!!it.done}" aria-label="Done">${icon.check}</button>
    ${it.label ? `<span class="slot-label">${esc(it.label)}</span>` : ''}
    ${timedRole || it.time ? time : ''}
    ${it.sticker ? stickerHTML(it.sticker, 'stk-line') : ''}
    <input class="line-text" data-fid="t-${it.id}" value="${esc(it.text)}" placeholder="${it.label ? `What's for ${esc(it.label.toLowerCase())}?` : ''}" enterkeyhint="next" aria-label="${esc(it.label || sec.title)} line">
    ${!timedRole && !it.time ? `<button class="icon-btn mini add-time" data-act="time" aria-label="Add time">${icon.clock}</button>` : ''}
    ${opts.noDelete ? '' : `<button class="icon-btn mini del" data-act="del-item" aria-label="Delete line">${icon.x}</button>`}
  </li>`;
}

function sectionHTML(sec, idx, total, { hourly = false } = {}) {
  const f = filled(sec.items); const done = f.filter((i) => i.done).length;
  const items = hourly ? sec.items.filter((i) => !(i.time && (i.text || '').trim())) : sec.items;
  const minLines = hourly ? 1 : sec.role === 'todo' || sec.role === 'sessions' ? 4 : 3;
  const ghosts = Math.max(0, minLines - items.length);
  const timedHere = hourly ? f.length - filled(items).length : 0;
  return `<article class="section c-${sec.color}" data-sec="${sec.id}">
    <header class="sec-head">
      <span class="sec-tab" aria-hidden="true"></span>
      ${sec.sticker ? stickerHTML(sec.sticker, 'stk-sec') : ''}
      <div class="sec-titles"><h2>${esc(sec.title)}</h2>${sec.subtitle ? `<p>${esc(sec.subtitle)}</p>` : ''}</div>
      ${f.length ? `<span class="sec-count ${done === f.length ? 'all' : ''}">${done}/${f.length}</span>` : ''}
      <button class="icon-btn" data-act="sec-menu" aria-label="Edit section ${esc(sec.title)}">${icon.more}</button>
    </header>
    <ul class="lines">
      ${items.map((it) => lineHTML(sec, it)).join('')}
      ${Array.from({ length: ghosts }, () => '<li class="line ghost" data-act="add-item" aria-hidden="true"></li>').join('')}
    </ul>
    <button class="add-line" data-act="add-item">${icon.plus}<span>Add a line</span></button>
    ${timedHere ? `<p class="hourly-note">${timedHere} timed line${timedHere > 1 ? 's' : ''} on the timeline</p>` : ''}
  </article>`;
}

function miniMonth(ctx, key) {
  const mk = monthKey(fromKey(key)); const today = todayKey();
  const d = fromKey(key); const ws = ctx.store.style.layout.weekStart;
  return `<div class="mini-month">
    <div class="mm-head"><button class="icon-btn mini" data-mm="-1" aria-label="Previous month">${icon.left}</button>
      <a href="#/month/${mk}">${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}</a>
      <button class="icon-btn mini" data-mm="1" aria-label="Next month">${icon.right}</button></div>
    <div class="mm-grid">${weekOrder(ws).map((i) => `<span class="mm-dow">${'SMTWTFS'[i]}</span>`).join('')}
    ${monthGrid(mk, ws).flat().map((k) => {
      const has = ctx.store.hasDay(k) && ctx.store.getDay(k).sections.some((s) => filled(s.items).length);
      return `<a class="mm-day ${k.startsWith(mk) ? '' : 'out'} ${k === key ? 'sel' : ''} ${k === today ? 'today' : ''} ${has ? 'has' : ''}" href="#/day/${k}">${fromKey(k).getDate()}</a>`;
    }).join('')}</div></div>`;
}

function hourlyHTML(ctx, day, anchors) {
  const { hourStart, hourEnd } = ctx.store.style.layout;
  const rows = new Map(); // hour -> html[]
  const put = (h, html) => { const k = Math.min(Math.max(h, hourStart - 1), hourEnd + 1); (rows.get(k) || rows.set(k, []).get(k)).push(html); };
  const timed = [];
  for (const sec of day.sections) for (const it of filled(sec.items)) if (it.time) timed.push({ sec, it });
  timed.sort((a, b) => a.it.time.localeCompare(b.it.time));
  for (const a of anchors) put(Math.floor(timeToMinutes(a.time) / 60), `<div class="hour-anchor">${icon.clock}${formatTime(a.time, true)}${a.end ? `–${formatTime(a.end, true)}` : ''} · ${esc(a.text)}</div>`);
  for (const { sec, it } of timed) put(Math.floor(timeToMinutes(it.time) / 60), `<div class="hour-item c-${sec.color}" data-sec="${sec.id}"><ul class="lines bare">${lineHTML(sec, it, {})}</ul></div>`);
  const isToday = day.key === todayKey(); const nowH = new Date().getHours();
  const label = (h) => (h < hourStart ? 'Earlier' : h > hourEnd ? 'Later' : formatTime(minutesToTime(h * 60), true));
  const hours = []; for (let h = hourStart - 1; h <= hourEnd + 1; h++) if ((h >= hourStart && h <= hourEnd) || rows.has(h)) hours.push(h);
  return `<ol class="hourly">${hours.map((h) => `<li class="hour-row ${isToday && h === nowH ? 'now' : ''}">
    <span class="hour-label">${label(h)}</span>
    <div class="hour-slot" ${h >= hourStart && h <= hourEnd ? `data-act="add-at" data-hour="${h}"` : ''}>${(rows.get(h) || []).join('')}</div></li>`).join('')}</ol>`;
}

export function renderDay(view, ctx, arg) {
  const { store } = ctx;
  const key = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : ctx.focusDate;
  const day = store.getDay(key);
  const d = fromKey(key);
  const weekend = isWeekend(key);
  const kind = weekend ? 'weekend' : 'weekday';
  const anchors = store.settings.showAnchors ? (store.settings.anchors[kind] || []) : [];
  const monthTitle = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  const layout = store.style.layout.day;
  const hourly = layout === 'hourly';
  const stickers = day.stickers || [];
  const sectionsHTML = `<div class="sections">
          ${day.sections.map((s, i) => sectionHTML(s, i, day.sections.length, { hourly })).join('')}
          <button class="add-section" data-act="add-section">${icon.plus}<span>Add a section</span></button>
        </div>`;

  view.innerHTML = `
  <section class="day-view layout-${layout} ${weekend ? 'is-weekend' : ''}">
    <div class="view-head">
      <div class="nav-group">
        <button class="icon-btn" data-nav="-1" aria-label="Previous day">${icon.left}</button>
        <button class="btn small ghost" data-nav="today">Today</button>
        <button class="icon-btn" data-nav="1" aria-label="Next day">${icon.right}</button>
      </div>
      <div class="head-actions">
        <a class="btn small" href="#/myday/${key}">${icon.list}<span>My Day list</span></a>
        <a class="btn small" href="#/lists/${key}"><span>Lists</span></a>
        <a class="btn small" href="#/eod/${key}"><span>End of day</span></a>
        <button class="btn small" data-act="export">${icon.cal}<span>Export</span></button>
      </div>
    </div>
    <div class="day-body">
      <div class="day-spread paper">
        <div class="month-band" aria-hidden="true"><span>${esc(monthTitle)}</span></div>
        <div class="day-title">
          <div class="dt-date"><span class="dt-num">${d.getDate()}</span><span class="dt-dow">${DAY_NAMES[d.getDay()]}</span></div>
          <div class="dt-meta">
            <span class="dt-month">${esc(monthTitle)}</span>
            <span class="layout-badge ${kind}">${weekend ? 'Weekend' : 'Weekday'} layout</span>
          </div>
          <div class="day-stickers">${stickers.map((v, i) => `<button class="day-stk" data-act="del-day-sticker" data-i="${i}" title="Tap to remove">${stickerHTML(v)}</button>`).join('')}
            ${stickers.length < 4 ? `<button class="add-stk" data-act="day-sticker" aria-label="Add a sticker to this day">${icon.plus}${icon.spark}</button>` : ''}</div>
          <p class="script-quote">${esc(quoteFor(ctx, key))}</p>
        </div>
        ${anchors.length && !hourly ? `<div class="anchor-strip">${anchors.map((a) => `<span class="anchor">${icon.clock}${formatTime(a.time, true)}${a.end ? `–${formatTime(a.end, true)}` : ''} · ${esc(a.text)}</span>`).join('')}</div>` : ''}
        ${hourly ? `<div class="hourly-wrap"><div class="hourly-col"><h2 class="md-h">Hour by hour</h2>${hourlyHTML(ctx, day, anchors)}</div><div class="hourly-secs">${sectionsHTML}</div></div>` : sectionsHTML}
        <div class="spine" aria-hidden="true"></div>
      </div>
      <aside class="day-side">
        ${miniMonth(ctx, key)}
        <div class="notes-col day-notes">
          <h2 class="notes-label">Notes</h2>
          <textarea class="lined-area" data-fid="day-notes" rows="9" aria-label="Notes for the day" placeholder="Brain dump here…">${esc(day.notes || '')}</textarea>
        </div>
        <div class="layout-box">
          <h3>This day's layout</h3>
          <p>New ${weekend ? 'weekend' : 'weekday'} days start with the ${weekend ? 'weekend' : 'weekday'} template.</p>
          <button class="btn small ${kind === 'weekday' ? 'primary' : ''}" data-act="save-tpl" data-kind="weekday">Save as weekday template</button>
          <button class="btn small ${kind === 'weekend' ? 'primary' : ''}" data-act="save-tpl" data-kind="weekend">Save as weekend template</button>
          <button class="btn small ghost" data-act="reset-day">Start this day over from template</button>
        </div>
      </aside>
    </div>
  </section>`;

  bindDay(view, ctx, key);
}

function sortByTime(items) {
  return [...items].sort((a, b) => {
    if (a.label && !b.label) return -1; if (!a.label && b.label) return 1;
    const ta = timeToMinutes(a.time), tb = timeToMinutes(b.time);
    if (ta == null && tb == null) return 0; if (ta == null) return 1; if (tb == null) return -1; return ta - tb;
  });
}

function bindDay(view, ctx, key) {
  const { store } = ctx;
  const secOf = (day, el) => day.sections.find((s) => s.id === el.closest('[data-sec]')?.dataset.sec);

  view.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act],[data-nav],[data-mm]');
    if (!el) return;
    if (el.dataset.nav) {
      const n = el.dataset.nav; const next = n === 'today' ? todayKey() : addDays(key, Number(n));
      ctx.focusDate = next; return ctx.go(`#/day/${next}`);
    }
    if (el.dataset.mm) {
      const dd = fromKey(key); dd.setMonth(dd.getMonth() + Number(el.dataset.mm), 1);
      const next = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-01`;
      ctx.focusDate = next; return ctx.go(`#/day/${next}`);
    }
    const act = el.dataset.act;
    const itemId = el.closest('[data-item]')?.dataset.item;
    switch (act) {
      case 'toggle':
        store.mutateDay(key, (day) => { const it = secOf(day, el).items.find((i) => i.id === itemId); it.done = !it.done; });
        break;
      case 'add-item': {
        let newId;
        store.mutateDay(key, (day) => { const it = makeItem(); newId = it.id; secOf(day, el).items.push(it); }, { silent: true });
        ctx.pendingFocus = `t-${newId}`; ctx.rerender();
        break;
      }
      case 'del-item':
        ctx.withUndo('Line deleted', () => store.mutateDay(key, (day) => { const s = secOf(day, el); s.items = s.items.filter((i) => i.id !== itemId); }));
        break;
      case 'time': openTime(el, ctx, key, itemId); break;
      case 'sec-menu': openSectionMenu(el, ctx, key, el.closest('[data-sec]').dataset.sec); break;
      case 'add-section': {
        let sid;
        store.mutateDay(key, (day) => {
          const used = new Set(day.sections.map((s) => s.color));
          const color = PALETTE.find((c) => !used.has(c)) || 'stone';
          const s = sectionFromBlueprint({ title: 'New section', subtitle: '', color, role: 'custom', slots: [] });
          s.items.push(makeItem()); sid = s.id; day.sections.push(s);
        });
        const btn = document.querySelector(`#view [data-sec="${sid}"] [data-act="sec-menu"]`); // view was re-rendered
        if (btn) { btn.scrollIntoView({ block: 'center' }); openSectionMenu(btn, ctx, key, sid, true); }
        break;
      }
      case 'export': openExport(el, ctx, key, 'day'); break;
      case 'day-sticker':
        openStickerPicker(el, ctx, { title: 'Sticker for this day', onPick: (v) => v && store.mutateDay(key, (dd) => { dd.stickers = [...(dd.stickers || []), v].slice(0, 4); }) });
        break;
      case 'del-day-sticker':
        store.mutateDay(key, (dd) => { dd.stickers.splice(Number(el.dataset.i), 1); });
        break;
      case 'add-at': {
        if (e.target.closest('.hour-item, .hour-anchor')) break; // clicks inside an item aren't "empty slot" clicks
        let newId;
        store.mutateDay(key, (dd) => {
          const sec = dd.sections.find((s) => s.role === 'todo') || dd.sections[0];
          const it = makeItem({ time: minutesToTime(Number(el.dataset.hour) * 60) }); newId = it.id; sec.items.push(it);
        }, { silent: true });
        ctx.pendingFocus = `t-${newId}`; ctx.rerender();
        break;
      }
      case 'save-tpl': {
        const kindName = el.dataset.kind;
        ctx.withUndo(`Saved as your ${kindName} template ✓`, () => store.setTemplate(kindName, blueprintFromDay(store.getDay(key))));
        break;
      }
      case 'reset-day':
        ctx.withUndo('Day reset to template', () => store.resetDay(key));
        break;
    }
  });

  // typing: save silently (no re-render per keystroke)
  view.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList.contains('line-text')) {
      const itemId = t.closest('[data-item]').dataset.item;
      store.mutateDay(key, (day) => { const it = secOf(day, t).items.find((i) => i.id === itemId); it.text = t.value; if (it.sample) delete it.sample; }, { silent: true });
    } else if (t.classList.contains('lined-area')) {
      store.mutateDay(key, (day) => { day.notes = t.value; delete day.notesSample; }, { silent: true });
    }
  });

  view.addEventListener('keydown', (e) => {
    const t = e.target; if (!t.classList.contains('line-text')) return;
    const itemId = t.closest('[data-item]').dataset.item;
    if (e.key === 'Enter') {
      e.preventDefault(); let newId;
      store.mutateDay(key, (day) => { const s = secOf(day, t); const idx = s.items.findIndex((i) => i.id === itemId); const it = makeItem(); newId = it.id; s.items.splice(idx + 1, 0, it); }, { silent: true });
      ctx.pendingFocus = `t-${newId}`; ctx.rerender();
    } else if (e.key === 'Backspace' && t.value === '') {
      const day = store.getDay(key); const s = secOf(day, t); const idx = s.items.findIndex((i) => i.id === itemId);
      if (s.items[idx].label) return;
      e.preventDefault();
      const prev = s.items[idx - 1];
      store.mutateDay(key, (dd) => { const ss = secOf(dd, t); ss.items.splice(idx, 1); }, { silent: true });
      ctx.pendingFocus = prev ? `t-${prev.id}` : null; ctx.rerender();
    }
  });
}

function openTime(anchor, ctx, key, itemId) {
  const { store } = ctx;
  const found = store.findItem(key, itemId); if (!found) return;
  const cur = found.item.time || '';
  const el = openPopover(anchor, `
    <h3 class="pop-title">${icon.clock} Line details</h3>
    <input type="time" class="time-input" value="${cur}" step="300" aria-label="Time">
    <div class="chips">${TIME_CHIPS.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-t="${v}">${l}</button>`).join('')}</div>
    <div class="line-stk-row"><span>Sticker</span>${found.item.sticker ? stickerHTML(found.item.sticker) : ''}<button class="btn small ghost" data-stk>${found.item.sticker ? 'Change' : `${icon.spark} Add sticker`}</button></div>
    <div class="pop-row"><button class="btn ghost" data-t="">No time</button><button class="btn primary" data-done>Done</button></div>`,
  { width: 290, onClose: () => ctx.rerender() });
  const set = (v) => store.mutateDay(key, (day) => { for (const s of day.sections) { const it = s.items.find((i) => i.id === itemId); if (it) it.time = v || null; } }, { silent: true });
  const inp = el.querySelector('.time-input');
  inp.addEventListener('input', () => set(inp.value));
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]');
    if (t) { set(t.dataset.t); closePopover(); }
    if (e.target.closest('[data-done]')) { set(inp.value); closePopover(); }
    if (e.target.closest('[data-stk]')) {
      openStickerPicker(() => document.querySelector(`#view [data-item="${itemId}"] .line-text`), ctx, { current: found.item.sticker, title: 'Sticker for this line',
        onPick: (v) => store.mutateDay(key, (day) => { for (const s of day.sections) { const it = s.items.find((i) => i.id === itemId); if (it) { if (v) it.sticker = v; else delete it.sticker; } } }) });
    }
  });
  if (!window.matchMedia('(pointer:coarse)').matches) inp.focus();
}

function openSectionMenu(anchor, ctx, key, secId, isNew = false) {
  const { store } = ctx;
  const day = store.getDay(key);
  const idx = day.sections.findIndex((s) => s.id === secId);
  const sec = day.sections[idx];
  const el = openPopover(anchor, `
    <h3 class="pop-title">Edit section</h3>
    <label class="field"><span>Name</span><input class="f-title" value="${esc(sec.title)}" data-fid="sm-title"></label>
    <label class="field"><span>Little note under the name</span><input class="f-sub" value="${esc(sec.subtitle)}" placeholder="optional"></label>
    <div class="field"><span>Color</span><div class="swatches">${PALETTE.map((c) => `<button class="swatch c-${c} ${c === sec.color ? 'on' : ''}" data-color="${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="field"><span>Sticker</span><div class="line-stk-row">${sec.sticker ? stickerHTML(sec.sticker) : ''}<button class="btn small ghost" data-m="sticker">${sec.sticker ? 'Change sticker' : `${icon.spark} Add a sticker`}</button></div></div>
    <label class="field"><span>Calendar event length</span><select class="f-dur">${[15, 30, 45, 60, 90, 120, 180].map((m) => `<option value="${m}" ${Number(sec.duration) === m ? 'selected' : ''}>${m < 60 ? m + ' min' : (m / 60) + ' hr'}</option>`).join('')}</select></label>
    <div class="menu-row">
      <button class="btn small ghost" data-m="up" ${idx === 0 ? 'disabled' : ''}>${icon.up} Move up</button>
      <button class="btn small ghost" data-m="down" ${idx === day.sections.length - 1 ? 'disabled' : ''}>${icon.down} Move down</button>
      <button class="btn small ghost" data-m="sort">${icon.sort} Sort by time</button>
    </div>
    <div class="pop-row"><button class="btn danger ghost" data-m="delete">${icon.trash} Delete section</button><button class="btn primary" data-m="done">Done</button></div>`,
  { width: 320, onClose: () => ctx.rerender() });
  const upd = (fn) => store.mutateDay(key, (dd) => fn(dd.sections.find((s) => s.id === secId), dd), { silent: true });
  el.querySelector('.f-title').addEventListener('input', (e) => upd((s) => { s.title = e.target.value || 'Untitled'; }));
  el.querySelector('.f-sub').addEventListener('input', (e) => upd((s) => { s.subtitle = e.target.value; }));
  el.querySelector('.f-dur').addEventListener('change', (e) => upd((s) => { s.duration = Number(e.target.value); }));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') closePopover(); });
  el.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (sw) {
      upd((s) => { s.color = sw.dataset.color; });
      el.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b === sw));
      const card = document.querySelector(`[data-sec="${secId}"]`);
      if (card) card.className = card.className.replace(/\bc-\w+/, `c-${sw.dataset.color}`);
      return;
    }
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
    if (m === 'done') return closePopover();
    if (m === 'sticker') {
      return openStickerPicker(() => document.querySelector(`#view [data-sec="${secId}"] [data-act="sec-menu"]`), ctx, { current: sec.sticker, title: `Sticker for ${sec.title}`,
        onPick: (v) => store.mutateDay(key, (dd) => { const s = dd.sections.find((x) => x.id === secId); if (v) s.sticker = v; else delete s.sticker; }) });
    }
    if (m === 'up' || m === 'down') {
      upd((s, dd) => { const i = dd.sections.indexOf(s); const j = m === 'up' ? i - 1 : i + 1; [dd.sections[i], dd.sections[j]] = [dd.sections[j], dd.sections[i]]; });
      closePopover();
    }
    if (m === 'sort') { upd((s) => { s.items = sortByTime(s.items); }); closePopover(); }
    if (m === 'delete') {
      closePopover();
      ctx.withUndo(`Deleted "${sec.title}"`, () => store.mutateDay(key, (dd) => { dd.sections = dd.sections.filter((s) => s.id !== secId); }));
    }
  });
  if (isNew) { const t = el.querySelector('.f-title'); t.focus(); t.select(); }
}

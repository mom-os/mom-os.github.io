import { monthGrid, monthKey, fromMonthKey, addMonths, todayKey, fromKey, MONTH_NAMES, DAY_NAMES, DAY_SHORT, holidayFor, formatTime, weekOrder } from '../dates.js';
import { stickerHTML } from '../style/stickers.js';
import { filled, dayStats } from '../store.js';
import { icon } from '../ui.js';
import { esc, uid, debounce } from '../util.js';
import { quoteFor } from './shared.js';
import { openExport } from './export.js';

export function renderMonth(view, ctx, arg) {
  const { store } = ctx;
  const mk = /^\d{4}-\d{2}$/.test(arg || '') ? arg : monthKey(fromKey(ctx.focusDate));
  const first = fromMonthKey(mk);
  const title = `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
  const ws = store.style.layout.weekStart;
  const order = weekOrder(ws);
  const weeks = monthGrid(mk, ws);
  const showStk = store.style.stickers.showInMonth;
  const today = todayKey();
  const notes = store.getMonthNotes(mk);
  const noteRows = Math.max(14, notes.length + 3);

  const cell = (key) => {
    const d = fromKey(key);
    const inMonth = key.startsWith(mk);
    const has = store.hasDay(key);
    const day = has ? store.getDay(key) : null;
    const hol = holidayFor(key);
    let preview = '', dots = '', badge = '', stk = '';
    if (day && inMonth && showStk && day.stickers?.length) stk = `<span class="mc-stk">${day.stickers.slice(0, 3).map((v) => stickerHTML(v)).join('')}</span>`;
    if (day && inMonth) {
      const timed = [], all = [];
      for (const s of day.sections) for (const it of filled(s.items)) { all.push({ s, it }); if (it.time) timed.push({ s, it }); }
      timed.sort((a, b) => a.it.time.localeCompare(b.it.time));
      const show = (timed.length ? timed : all).slice(0, 3);
      preview = show.map(({ s, it }) => `<li class="mc-line c-${s.color} ${it.done ? 'done' : ''}">${it.time ? `<b>${formatTime(it.time, true)}</b> ` : ''}${esc(it.label ? it.label + ': ' : '')}${esc(it.text)}</li>`).join('');
      const extra = all.length - show.length;
      if (extra > 0) preview += `<li class="mc-more">+${extra} more</li>`;
      const secs = day.sections.filter((s) => filled(s.items).length);
      dots = secs.map((s) => `<span class="dot c-${s.color}" title="${esc(s.title)}: ${filled(s.items).length}"></span>`).join('');
      const st = dayStats(day);
      if (st.total) badge = `<span class="mc-count ${st.done === st.total ? 'all' : ''}">${st.done}/${st.total}</span>`;
    }
    return `<button class="mcell ${inMonth ? '' : 'out'} ${key === today ? 'today' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'wkend' : ''}"
        data-day="${key}" aria-label="${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}">
      <span class="mc-num">${d.getDate()}</span>
      ${badge}
      ${preview ? `<ul class="mc-lines">${preview}</ul>` : ''}
      ${dots || stk ? `<span class="mc-dots">${stk}${dots}</span>` : ''}
      ${hol && inMonth ? `<span class="mc-hol">${esc(hol)}</span>` : ''}
    </button>`;
  };

  const rows = weeks.map((w) => w.slice(0, 3).map(cell).join('') + '<span class="spine-gap" aria-hidden="true"></span>' + w.slice(3).map(cell).join('')).join('');

  view.innerHTML = `
  <section class="month-view">
    <div class="view-head">
      <div class="nav-group">
        <button class="icon-btn" data-nav="-1" aria-label="Previous month">${icon.left}</button>
        <button class="btn small ghost" data-nav="today">Today</button>
        <button class="icon-btn" data-nav="1" aria-label="Next month">${icon.right}</button>
      </div>
      <h1 class="phone-title">${esc(title)}</h1>
      <button class="btn small" data-export>${icon.cal}<span>Export month</span></button>
    </div>
    <div class="month-spread paper">
      <aside class="notes-col month-notes">
        <h2 class="notes-label">Notes</h2>
        <ol class="lined-list">
          ${Array.from({ length: noteRows }, (_, i) => { const n = notes[i];
            return `<li><input class="note-input" data-fid="mn-${i}" data-ni="${i}" value="${esc(n?.text || '')}" aria-label="Month note ${i + 1}"></li>`; }).join('')}
        </ol>
      </aside>
      <div class="month-page">
        <div class="ribbon"><span>${esc(title)}</span></div>
        <div class="mgrid">
          ${order.slice(0, 3).map((i) => `<div class="mhead"><span class="full">${DAY_NAMES[i]}</span><span class="short">${DAY_SHORT[i]}</span></div>`).join('')}
          <span class="spine-gap head" aria-hidden="true"></span>
          ${order.slice(3).map((i) => `<div class="mhead"><span class="full">${DAY_NAMES[i]}</span><span class="short">${DAY_SHORT[i]}</span></div>`).join('')}
          ${rows}
        </div>
        <div class="spine" aria-hidden="true"></div>
        <p class="script-quote month-quote">${esc(quoteFor(ctx, mk))}</p>
      </div>
    </div>
  </section>`;

  view.querySelector('.view-head').addEventListener('click', (e) => {
    const n = e.target.closest('[data-nav]')?.dataset.nav;
    if (n === 'today') { ctx.focusDate = today; ctx.go(`#/month/${monthKey(fromKey(today))}`); }
    else if (n) { const next = addMonths(mk, Number(n)); ctx.focusDate = `${next}-01`; ctx.go(`#/month/${next}`); }
    const ex = e.target.closest('[data-export]');
    if (ex) openExport(ex, ctx, ctx.focusDate.startsWith(mk) ? ctx.focusDate : `${mk}-01`, 'month');
  });
  view.querySelector('.mgrid').addEventListener('click', (e) => {
    const c = e.target.closest('[data-day]'); if (!c) return;
    ctx.focusDate = c.dataset.day; ctx.go(`#/day/${c.dataset.day}`);
  });
  const saveNotes = debounce(() => {
    const list = [...view.querySelectorAll('.note-input')].map((inp, i) => {
      const prev = store.getMonthNotes(mk)[i];
      const text = inp.value;
      return { id: prev?.id || uid('mn'), text, ...(prev?.sample && prev.text === text ? { sample: true } : {}) };
    });
    while (list.length && !list[list.length - 1].text.trim()) list.pop();
    store.setMonthNotes(mk, list, { silent: true });
  }, 300);
  view.querySelector('.month-notes').addEventListener('input', saveNotes);
}

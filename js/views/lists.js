import { addDays, todayKey, fromKey, DAY_NAMES, MONTH_NAMES } from '../dates.js';
import { PALETTE, LIST_STARTERS, makeList, makeListItem } from '../templates.js';
import { icon, openPopover, closePopover, confirmSheet } from '../ui.js';
import { esc, uid } from '../util.js';

export function renderLists(view, ctx, arg) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : ctx.focusDate || todayKey();
  ctx.focusDate = key;
  const day = ctx.store.getDay(key);
  const d = fromKey(key);
  const isToday = key === todayKey();
  const lists = day.lists || [];
  const templates = ctx.store.listTemplates;

  view.innerHTML = `
  <section class="lists-view">
    <div class="view-head">
      <div class="nav-group">
        <button class="icon-btn" data-nav="-1" aria-label="Previous day">${icon.left}</button>
        <button class="btn small ghost" data-nav="today">Today</button>
        <button class="icon-btn" data-nav="1" aria-label="Next day">${icon.right}</button>
      </div>
      <div class="head-actions">
        <a class="btn small" href="#/eod/${key}">End of day</a>
        <button class="btn small primary" data-act="new-list">${icon.plus}<span>New list</span></button>
      </div>
    </div>
    <div class="lists-layout paper">
      <header class="lists-hero">
        <div>
          <p class="script-title">Lists</p>
          <h1 class="md-date">${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${isToday ? ' <span class="today-pill">today</span>' : ''}</h1>
          <p class="lists-sub">Packing, groceries, shot lists — saved with this day and synced everywhere.</p>
        </div>
        ${lists.length ? `<button class="btn small" data-act="from-tpl">${icon.spark}<span>Add from template</span></button>` : ''}
      </header>
      ${lists.length ? `<div class="lists-grid">${lists.map((L, i) => listCardHTML(L, i, lists.length)).join('')}</div>`
        : emptyHTML(templates)}
    </div>
  </section>`;

  bindLists(view, ctx, key);
}

function emptyHTML(templates) {
  const starters = LIST_STARTERS.map((s, i) =>
    `<button class="list-starter c-${s.color}" data-act="starter" data-i="${i}">
      <span class="ls-dot"></span><b>${esc(s.title)}</b>
      <span>${s.items.length ? s.items.slice(0, 3).join(' · ') : 'Start blank'}</span>
    </button>`).join('');
  return `<div class="lists-empty">
    <div class="lists-empty-card">
      <p class="script-title">Nothing here yet</p>
      <p>Make a list for today — packing, groceries, session shots, kid stuff. It stays with this day.</p>
      <button class="btn primary" data-act="new-list">${icon.plus} New list</button>
      ${templates.length ? `<button class="btn" data-act="from-tpl">${icon.spark} Add from template</button>` : ''}
    </div>
    <div class="list-starters">
      <h2 class="md-h">Try a starter</h2>
      <div class="list-starter-row">${starters}</div>
    </div>
  </div>`;
}

function listCardHTML(L, idx, total) {
  const done = L.items.filter((i) => i.done).length;
  const totalItems = L.items.length;
  return `<article class="list-card c-${L.color}" data-list="${L.id}">
    <header class="list-card-head">
      <span class="list-swatch" aria-hidden="true"></span>
      <input class="list-title" data-fid="lt-${L.id}" value="${esc(L.title)}" aria-label="List name">
      ${totalItems ? `<span class="sec-count ${done === totalItems ? 'all' : ''}">${done}/${totalItems}</span>` : ''}
      <button class="icon-btn" data-act="list-menu" aria-label="List options">${icon.more}</button>
    </header>
    <ul class="list-items">
      ${L.items.map((it, i) => `<li class="list-item ${it.done ? 'done' : ''}" data-item="${it.id}">
        <button class="check" data-act="toggle" role="checkbox" aria-checked="${!!it.done}" aria-label="Done">${icon.check}</button>
        <input class="line-text" data-fid="li-${it.id}" value="${esc(it.text)}" placeholder="Item…" enterkeyhint="done" aria-label="List item">
        <button class="icon-btn mini" data-act="item-up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon.up}</button>
        <button class="icon-btn mini" data-act="item-down" ${i === L.items.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon.down}</button>
        <button class="icon-btn mini del" data-act="del-item" aria-label="Delete item">${icon.x}</button>
      </li>`).join('')}
    </ul>
    <form class="list-add" autocomplete="off" data-act="add-item">
      <input name="q" data-fid="add-${L.id}" placeholder="Add an item…" aria-label="Add item" enterkeyhint="done">
      <button class="btn small primary" type="submit" aria-label="Add">${icon.plus}</button>
    </form>
  </article>`;
}

function findList(day, id) { return (day.lists || []).find((l) => l.id === id); }

function bindLists(view, ctx, key) {
  const { store } = ctx;

  view.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act],[data-nav]');
    if (!el) return;

    if (el.dataset.nav) {
      const n = el.dataset.nav;
      const next = n === 'today' ? todayKey() : addDays(key, Number(n));
      ctx.focusDate = next;
      return ctx.go(`#/lists/${next}`);
    }

    if (el.dataset.act === 'new-list') {
      const list = makeList({ title: 'New list', color: PALETTE[Math.floor(Math.random() * PALETTE.length)] });
      store.mutateDay(key, (d) => { d.lists.push(list); });
      ctx.pendingFocus = `lt-${list.id}`;
      return;
    }

    if (el.dataset.act === 'starter') {
      const s = LIST_STARTERS[Number(el.dataset.i)];
      if (!s) return;
      const list = makeList(s);
      store.mutateDay(key, (d) => { d.lists.push(list); });
      ctx.toast(`Added “${s.title}”`);
      return;
    }

    if (el.dataset.act === 'from-tpl') {
      return openFromTemplate(el, ctx, key);
    }

    const card = el.closest('[data-list]');
    const listId = card?.dataset.list;

    if (el.dataset.act === 'toggle' && listId) {
      const itemId = el.closest('[data-item]')?.dataset.item;
      store.mutateDay(key, (d) => {
        const L = findList(d, listId);
        const it = L?.items.find((i) => i.id === itemId);
        if (it) it.done = !it.done;
      });
      return;
    }

    if (el.dataset.act === 'del-item' && listId) {
      const itemId = el.closest('[data-item]')?.dataset.item;
      store.mutateDay(key, (d) => {
        const L = findList(d, listId);
        if (L) L.items = L.items.filter((i) => i.id !== itemId);
      });
      return;
    }

    if ((el.dataset.act === 'item-up' || el.dataset.act === 'item-down') && listId) {
      const itemId = el.closest('[data-item]')?.dataset.item;
      const dir = el.dataset.act === 'item-up' ? -1 : 1;
      store.mutateDay(key, (d) => {
        const L = findList(d, listId);
        if (!L) return;
        const i = L.items.findIndex((x) => x.id === itemId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= L.items.length) return;
        [L.items[i], L.items[j]] = [L.items[j], L.items[i]];
      });
      return;
    }

    if (el.dataset.act === 'list-menu' && listId) {
      return openListMenu(el, ctx, key, listId);
    }
  });

  view.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList.contains('list-title')) {
      const listId = t.closest('[data-list]')?.dataset.list;
      store.mutateDay(key, (d) => { const L = findList(d, listId); if (L) L.title = t.value; }, { silent: true });
      return;
    }
    if (t.classList.contains('line-text') && t.closest('[data-list]')) {
      const listId = t.closest('[data-list]')?.dataset.list;
      const itemId = t.closest('[data-item]')?.dataset.item;
      store.mutateDay(key, (d) => {
        const L = findList(d, listId);
        const it = L?.items.find((i) => i.id === itemId);
        if (it) it.text = t.value;
      }, { silent: true });
    }
  });

  view.addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList.contains('list-title') || (t.classList.contains('line-text') && t.closest('[data-list]'))) {
      store.commit('day');
    }
  });

  view.addEventListener('submit', (e) => {
    const form = e.target.closest('form.list-add');
    if (!form) return;
    e.preventDefault();
    const listId = form.closest('[data-list]')?.dataset.list;
    const q = (form.q?.value || '').trim();
    if (!q || !listId) return;
    const item = makeListItem({ text: q });
    store.mutateDay(key, (d) => { findList(d, listId)?.items.push(item); });
    ctx.pendingFocus = `add-${listId}`;
  });
}

function openFromTemplate(anchor, ctx, key) {
  const tpls = ctx.store.listTemplates;
  if (!tpls.length) {
    return ctx.toast('Save a list as a template first (⋯ on a list)');
  }
  const html = `<p class="pop-title">Add from template</p>
    <ul class="pop-list">${tpls.map((t) =>
      `<li><button data-tpl="${t.id}" class="pop-row-btn c-${t.color}"><span class="ls-dot"></span><b>${esc(t.title)}</b><span>${t.items.length} items</span></button></li>`
    ).join('')}</ul>`;
  const el = openPopover(anchor, html, { width: 280 });
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tpl]');
    if (!btn) return;
    const tpl = tpls.find((t) => t.id === btn.dataset.tpl);
    if (!tpl) return;
    const list = makeList({ title: tpl.title, color: tpl.color, items: tpl.items.map((i) => i.text || i) });
    ctx.store.mutateDay(key, (d) => { d.lists.push(list); });
    closePopover();
    ctx.toast(`Added “${tpl.title}”`);
  });
}

function openListMenu(anchor, ctx, key, listId) {
  const day = ctx.store.getDay(key);
  const L = findList(day, listId);
  if (!L) return;
  const colors = PALETTE.map((c) =>
    `<button class="swatch c-${c} ${c === L.color ? 'on' : ''}" data-color="${c}" aria-label="${c}"></button>`
  ).join('');
  const html = `<p class="pop-title">${esc(L.title)}</p>
    <div class="swatch-row">${colors}</div>
    <div class="pop-stack">
      <button class="btn small" data-a="save-tpl">${icon.spark} Save as list template</button>
      <button class="btn small" data-a="list-up" ${day.lists[0]?.id === listId ? 'disabled' : ''}>${icon.up} Move list up</button>
      <button class="btn small" data-a="list-down" ${day.lists[day.lists.length - 1]?.id === listId ? 'disabled' : ''}>${icon.down} Move list down</button>
      <button class="btn small danger" data-a="del-list">${icon.trash} Delete list</button>
    </div>`;
  const el = openPopover(anchor, html, { width: 280 });
  el.addEventListener('click', async (e) => {
    const color = e.target.closest('[data-color]')?.dataset.color;
    if (color) {
      ctx.store.mutateDay(key, (d) => { const x = findList(d, listId); if (x) x.color = color; });
      closePopover();
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'save-tpl') {
      const snap = { id: uid('ltpl'), title: L.title, color: L.color, items: L.items.map((i) => ({ text: i.text })) };
      const next = [...ctx.store.listTemplates.filter((t) => t.title !== snap.title), snap];
      ctx.store.setListTemplates(next);
      closePopover();
      ctx.toast(`Saved “${L.title}” as a template`);
      return;
    }
    if (a === 'list-up' || a === 'list-down') {
      const dir = a === 'list-up' ? -1 : 1;
      ctx.store.mutateDay(key, (d) => {
        const i = d.lists.findIndex((x) => x.id === listId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.lists.length) return;
        [d.lists[i], d.lists[j]] = [d.lists[j], d.lists[i]];
      });
      closePopover();
      return;
    }
    if (a === 'del-list') {
      closePopover();
      const ok = await confirmSheet(anchor, `Delete “${L.title}”?`, 'Delete');
      if (!ok) return;
      ctx.withUndo(`Deleted “${L.title}”`, () => {
        ctx.store.mutateDay(key, (d) => { d.lists = d.lists.filter((x) => x.id !== listId); });
      });
    }
  });
}

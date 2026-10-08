import { PACKS, EMOJI, stickerHTML } from './stickers.js';
import { openPopover, closePopover, icon } from '../ui.js';
import { esc } from '../util.js';

/** Sticker chooser popover. onPick(value) gets "p:id" / "e:😊", or null to remove. */
export function openStickerPicker(anchor, ctx, { current = null, onPick, title = 'Add a sticker' }) {
  const st = ctx.store.style.stickers;
  const tabs = [
    ...(st.recent.length ? [['recent', 'Recent']] : []),
    ...st.packs.filter((p) => PACKS[p]).map((p) => [p, PACKS[p].name]),
    ['emoji', 'Emoji'],
  ];
  let tab = tabs[0][0];
  const grid = () => {
    if (tab === 'recent') return st.recent.map((v) => btn(v)).join('');
    if (tab === 'emoji') return Object.entries(EMOJI).map(([g, list]) => `<p class="stk-group">${esc(g)}</p>${list.map((e) => btn('e:' + e)).join('')}`).join('');
    return Object.keys(PACKS[tab].items).map((id) => btn('p:' + id)).join('');
  };
  const btn = (v) => `<button class="stk-btn ${v === current ? 'on' : ''}" data-v="${esc(v)}" aria-label="sticker">${stickerHTML(v)}</button>`;
  const html = () => `
    <h3 class="pop-title">${icon.spark} ${esc(title)}</h3>
    <div class="stk-tabs">${tabs.map(([id, n]) => `<button class="chip ${id === tab ? 'on' : ''}" data-tab="${id}">${esc(n)}</button>`).join('')}</div>
    <div class="stk-grid">${grid()}</div>
    ${tab === 'emoji' ? '<label class="field"><span>Or type/paste any emoji</span><input class="stk-free" maxlength="8" placeholder="🌺" inputmode="text"></label>' : ''}
    <div class="pop-row">${current ? '<button class="btn ghost danger" data-remove>Remove sticker</button>' : ''}<button class="btn ghost" data-close>Close</button></div>`;
  const el = openPopover(anchor, html(), { width: 330, className: 'stk-pop' });
  const rerender = () => { el.innerHTML = (el.classList.contains('sheet') ? '<div class="sheet-grip"></div>' : '') + html(); };
  const pick = (v) => {
    if (v) ctx.store.updateStyle((s) => { s.stickers.recent = [v, ...s.stickers.recent.filter((x) => x !== v)].slice(0, 16); }, { silent: true });
    closePopover(); onPick(v);
  };
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return rerender(); }
    const v = e.target.closest('[data-v]'); if (v) return pick(v.dataset.v);
    if (e.target.closest('[data-remove]')) return pick(null);
    if (e.target.closest('[data-close]')) closePopover();
  });
  el.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('stk-free') && e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); pick('e:' + e.target.value.trim()); }
  });
}

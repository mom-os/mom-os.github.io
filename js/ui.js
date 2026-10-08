import { esc } from './util.js';

export const icon = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 13v5M9.5 15.5L12 18l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7h11M9 12h11M9 17h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.5" cy="7" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="17" r="1.3" fill="currentColor"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" fill="currentColor"/></svg>',
};

// ---------- popover / bottom sheet ----------
let openPop = null;
export function closePopover() {
  if (!openPop) return;
  openPop.el.remove(); document.removeEventListener('pointerdown', openPop.outside, true);
  document.removeEventListener('keydown', openPop.key, true);
  const cb = openPop.onClose; openPop = null; cb?.();
}
/** Opens a floating panel near `anchor` (bottom sheet on phones). Returns the panel element. */
export function openPopover(anchor, html, { className = '', onClose, width = 300 } = {}) {
  closePopover();
  // anchor may be a function (resolved after the previous popover closed and the view re-rendered)
  if (typeof anchor === 'function') anchor = anchor();
  if (!anchor || !anchor.isConnected) anchor = document.querySelector('#view .view-head') || document.body;
  const root = document.getElementById('popover-root');
  const el = document.createElement('div');
  const sheet = window.matchMedia('(max-width: 640px)').matches;
  el.className = `popover ${sheet ? 'sheet' : ''} ${className}`;
  el.setAttribute('role', 'dialog');
  el.innerHTML = (sheet ? '<div class="sheet-grip"></div>' : '') + html;
  root.appendChild(el);
  if (sheet) {
    const scrim = document.createElement('div'); scrim.className = 'scrim'; el.before(scrim);
    onClose = ((orig) => () => { scrim.remove(); orig?.(); })(onClose);
  } else {
    el.style.width = `${width}px`;
    const r = anchor.getBoundingClientRect();
    const pw = el.offsetWidth, ph = el.offsetHeight;
    let left = Math.min(Math.max(8, r.right - pw), window.innerWidth - pw - 8);
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    el.style.left = `${left + window.scrollX}px`; el.style.top = `${top + window.scrollY}px`;
  }
  const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const key = (e) => { if (e.key === 'Escape') closePopover(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  document.addEventListener('keydown', key, true);
  openPop = { el, outside, key, onClose };
  return el;
}

// ---------- toast ----------
export function toast(msg, { action, ms = 3800 } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-btn">${esc(action.label)}</button>` : ''}`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const kill = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); };
  if (action) el.querySelector('button').onclick = () => { action.fn(); kill(); };
  setTimeout(kill, ms);
}

export function confirmSheet(anchor, message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    let answered = false;
    const el = openPopover(anchor, `<p class="pop-msg">${esc(message)}</p>
      <div class="pop-row"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">${esc(okLabel)}</button></div>`,
    { onClose: () => { if (!answered) resolve(false); }, width: 260 });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      answered = true; resolve(a === 'yes'); closePopover();
    });
  });
}

import { Store } from './store.js';
import { seedSample, clearSample } from './seed.js';
import { todayKey, monthKey, fromKey } from './dates.js';
import { applyStyle } from './style/engine.js';
import { toast, closePopover } from './ui.js';
import { renderMonth } from './views/month.js';
import { renderDay } from './views/day.js';
import { renderMyDay } from './views/myday.js';
import { renderStudio } from './views/studio.js';
import { renderLists } from './views/lists.js';
import { renderEndOfDay } from './views/endofday.js';
import { SyncEngine, SyncStatus } from './sync/engine.js';
import { syncChipHTML } from './views/account.js';
import { isSupabaseConfigured } from './config.js';
import { recoverAuthFromUrl, urlHasAuthCallback } from './sync/client.js';

const store = new Store();
if (!store.state.meta.seeded) seedSample(store);

let view = document.getElementById('view');
const ctx = {
  store,
  sync: null,
  focusDate: todayKey(),
  go(hash) { if (location.hash === hash) render(); else location.hash = hash; },
  rerender: () => render(),
  toast,
  /** snapshot -> run destructive fn -> toast with Undo */
  withUndo(label, fn) {
    const snap = store.snapshot(); fn();
    toast(label, { action: { label: 'Undo', fn: () => store.restore(snap) } });
  },
  clearSample() {
    ctx.withUndo('Sample data cleared', () => clearSample(store));
  },
  loadSample() { seedSample(store); toast('Sample days added (Oct 8 & Oct 10, 2026)'); },
};

function renderSyncChip() {
  const brand = document.querySelector('.brand');
  if (!brand) return;
  let chip = brand.querySelector('.sync-chip');
  const html = syncChipHTML(ctx.sync);
  if (!html) { chip?.remove(); return; }
  if (!chip) { brand.insertAdjacentHTML('beforeend', html); chip = brand.querySelector('.sync-chip'); }
  else chip.outerHTML = html;
  brand.querySelector('.sync-chip')?.addEventListener('click', () => ctx.go('#/style/account'));
}


function parseRoute() {
  const raw = location.hash || '#/myday';
  // Auth redirects use #access_token=... — not an app route
  if (raw.includes('access_token') || raw.includes('error_description') || raw.includes('refresh_token=')) {
    return { name: 'myday', arg: todayKey() };
  }
  const parts = raw.replace(/^#\/?/, '').split('/');
  const name = ['month', 'day', 'myday', 'lists', 'eod', 'style'].includes(parts[0]) ? parts[0] : 'myday';
  return { name, arg: parts[1] };
}

export function applyTheme() { applyStyle(store.settings); }

function updateTabs(route) {
  const fd = ctx.focusDate;
  const hrefs = { month: `#/month/${monthKey(fromKey(fd))}`, day: `#/day/${fd}`, myday: `#/myday/${fd}`, lists: `#/lists/${fd}`, eod: `#/eod/${fd}`, style: '#/style' };
  for (const a of document.querySelectorAll('#tabs .tab')) {
    a.href = hrefs[a.dataset.tab];
    a.classList.toggle('active', a.dataset.tab === route.name);
    a.setAttribute('aria-current', a.dataset.tab === route.name ? 'page' : 'false');
  }
}

function renderBanner() {
  const b = document.getElementById('sample-banner');
  const show = store.state.meta.sampleActive && !sessionStorage.getItem('hideSampleBanner');
  b.hidden = !show;
  if (!show) return;
  b.innerHTML = `<span>You're looking at <b>example items</b> on Oct 8 &amp; Oct 10, 2026.</span>
    <span class="sb-actions"><button class="btn small" data-sb="clear">Clear sample data</button>
    <button class="btn small ghost" data-sb="hide">Keep for now</button></span>`;
}
document.getElementById('sample-banner').addEventListener('click', (e) => {
  const a = e.target.closest('[data-sb]')?.dataset.sb;
  if (a === 'clear') ctx.clearSample();
  if (a === 'hide') { sessionStorage.setItem('hideSampleBanner', '1'); renderBanner(); }
});

let lastRouteKey = '';
function render() {
  closePopover();
  const route = parseRoute();
  if (route.name === 'day' || route.name === 'myday' || route.name === 'lists' || route.name === 'eod') ctx.focusDate = /^\d{4}-\d{2}-\d{2}$/.test(route.arg || '') ? route.arg : ctx.focusDate;
  if (route.name === 'month' && /^\d{4}-\d{2}$/.test(route.arg || '') && !ctx.focusDate.startsWith(route.arg)) ctx.focusDate = `${route.arg}-01`;
  applyTheme(); updateTabs(route); renderBanner(); renderSyncChip();

  // keep focus + caret + scroll across re-renders
  const routeKey = `${route.name}/${route.arg || ''}`;
  const active = document.activeElement;
  const fid = active?.dataset?.fid; const sel = fid && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
  const scroll = window.scrollY;

  // fresh node each render so per-view listeners never pile up
  const fresh = view.cloneNode(false); view.replaceWith(fresh); view = fresh;
  view.dataset.view = route.name;
  document.body.dataset.view = route.name;
  // cloneNode drops listeners — allow Account to re-bind on the new node
  ctx._accountActionsBound = false;
  ({ month: renderMonth, day: renderDay, myday: renderMyDay, lists: renderLists, eod: renderEndOfDay, style: renderStudio })[route.name](view, ctx, route.arg);

  if (routeKey === lastRouteKey) {
    window.scrollTo(0, scroll);
    if (fid) { const el = view.querySelector(`[data-fid="${fid}"]`); if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch {} } }
  } else window.scrollTo(0, 0);
  lastRouteKey = routeKey;
  if (ctx.pendingFocus) {
    const el = view.querySelector(`[data-fid="${ctx.pendingFocus}"]`); ctx.pendingFocus = null;
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
  }
}

// style edits marked silent still need the CSS re-applied (live preview without a full re-render)
store.subscribe(() => render());
ctx.applyStyleOnly = () => applyTheme();
window.addEventListener('hashchange', () => {
  // Ignore the transient hash="" clear from supabase after reading tokens
  if (urlHasAuthCallback()) return;
  render();
});

async function boot() {
  const hadCallback = urlHasAuthCallback();
  let recovered = { session: null, fromUrl: false, errorMessage: null };
  try {
    recovered = await recoverAuthFromUrl();
  } catch (e) {
    console.warn('auth recover', e);
  }
  ctx.sync = new SyncEngine(store, { onStatus: () => renderSyncChip() });
  try {
    await ctx.sync.start();
  } catch (e) {
    console.warn('sync start', e);
  }
  render();
  renderSyncChip();
  if (recovered.fromUrl && recovered.session) {
    ctx.toast('Signed in — syncing…');
    if (!location.hash.startsWith('#/')) ctx.go('#/myday');
  } else if (hadCallback && !recovered.session) {
    ctx.go('#/style/account');
    ctx.toast(recovered.errorMessage || 'Sign-in link didn’t stick — try the 6-digit code, or ask for a new link.');
  }
}
boot();

function showSwUpdateBanner(reg) {
  if (document.getElementById('sw-update-banner')) return;
  const b = document.createElement('div');
  b.id = 'sw-update-banner';
  b.className = 'sw-update-banner';
  b.innerHTML = `<span>New version available</span><button type="button" class="btn small primary">Tap to refresh</button>`;
  b.querySelector('button').onclick = () => {
    try { reg?.waiting?.postMessage('skipWaiting'); } catch {}
    location.reload();
  };
  document.body.appendChild(b);
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    const swUrl = new URL('../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl, { scope: new URL('../', import.meta.url).pathname, updateViaCache: 'none' })
      .then((reg) => {
        if (reg.waiting) showSwUpdateBanner(reg);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showSwUpdateBanner(reg);
          });
        });
        // Proactively check for updates when Account is opened / tab focuses
        const check = () => reg.update().catch(() => {});
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
        setTimeout(check, 2000);
      })
      .catch((e) => console.warn('SW failed', e));
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  });
}
window.__planner = { store, ctx }; // handy for debugging in devtools

import { collectEvents } from '../calendar/events.js';
import { providers } from '../calendar/providers.js';
import { weekRange, monthRange, monthKey, fromKey, prettyDate, MONTH_NAMES } from '../dates.js';
import { openPopover, closePopover, icon, toast } from '../ui.js';
import { esc } from '../util.js';

let WS = 0; // week start, set from the store when the panel opens
export function rangeFor(kind, dateKey) {
  if (kind === 'day') return [dateKey, dateKey];
  if (kind === 'week') return weekRange(dateKey, WS);
  return monthRange(monthKey(fromKey(dateKey)));
}
function rangeLabel(kind, dateKey) {
  if (kind === 'day') return prettyDate(dateKey);
  if (kind === 'week') { const [a, b] = weekRange(dateKey, WS); return `Week of ${prettyDate(a).split(', ')[1]} – ${prettyDate(b).split(', ')[1]}`; }
  const d = fromKey(dateKey); return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Calendar export panel (day / week / month → .ics). */
export function openExport(anchor, ctx, dateKey, initial = 'day') {
  const { store } = ctx;
  WS = store.style.layout.weekStart;
  let kind = initial;
  const count = (k) => collectEvents(store, ...rangeFor(k, dateKey)).length;
  const html = () => `
    <h3 class="pop-title">${icon.cal} Add to Apple Calendar</h3>
    <p class="pop-help">Exports timed lines as an <b>.ics</b> file (Central time) with calendar alarms (VALARM). Lines with a bell use their offset; others can get the optional 10-minute heads-up below. Open the file on your iPhone or Mac to add events to iCloud Calendar — that is how you get lock-screen alarms today.</p>
    <div class="seg" role="radiogroup">
      ${['day', 'week', 'month'].map((k) => `<button class="seg-btn ${k === kind ? 'on' : ''}" data-k="${k}" role="radio" aria-checked="${k === kind}">
        This ${k}<small>${count(k)} timed</small></button>`).join('')}
    </div>
    <p class="pop-sub">${esc(rangeLabel(kind, dateKey))}</p>
    <label class="chk"><input type="checkbox" id="ex-alarm" checked> Default 10-min reminder (items with their own bell use that instead)</label>
    <label class="chk"><input type="checkbox" id="ex-done"> Include things already checked off</label>
    <div class="pop-row">
      ${providers.icsShare.available ? '<button class="btn ghost" data-go="icsShare">Share…</button>' : ''}
      <button class="btn primary" data-go="icsDownload">Download .ics</button>
    </div>
    <div class="pop-sub-block">
      <h4 class="pop-h">Subscribe in Apple Calendar</h4>
      <p class="pop-help">Live feed of timed items (past 30 → next 180 days). Updates when Mom.OS syncs.</p>
      ${ctx.sync?.user && ctx.sync?.webcalUrl() ? `
        <label class="field"><span>webcal link</span>
          <input class="ex-feed" readonly value="${esc(ctx.sync.webcalUrl())}"></label>
        <div class="pop-row">
          <button class="btn ghost" data-go="copyFeed">Copy link</button>
          <a class="btn primary" href="${esc(ctx.sync.webcalUrl())}">Open subscription</a>
        </div>
        <p class="pop-help"><b>iPhone:</b> tap Open, or Settings → Calendar → Accounts → Add Subscribed Calendar.<br>
        <b>Windows:</b> Outlook / iCloud for Windows → Add calendar → From internet.</p>
      ` : `<p class="pop-help">${ctx.sync?.user ? 'Generating your feed link… open <b>Style → Account</b> if it doesn’t appear.' : 'Sign in under <b>Style → Account</b> to get a private live subscription link.'}</p>`}
    </div>
    <div class="pop-later"><b>Coming later:</b> ${esc(providers.caldav.label)}</div>`;
  const el = openPopover(anchor, html(), { width: 340, className: 'export-pop' });
  el.addEventListener('click', async (e) => {
    const seg = e.target.closest('[data-k]');
    if (seg) { kind = seg.dataset.k; const alarm = el.querySelector('#ex-alarm').checked; const done = el.querySelector('#ex-done').checked;
      el.innerHTML = (el.classList.contains('sheet') ? '<div class="sheet-grip"></div>' : '') + html();
      el.querySelector('#ex-alarm').checked = alarm; el.querySelector('#ex-done').checked = done; return; }
    const go = e.target.closest('[data-go]')?.dataset.go;
    if (!go) return;
    const includeDone = el.querySelector('#ex-done').checked;
    const alarmMinutes = el.querySelector('#ex-alarm').checked ? 10 : 0;
    const [a, b] = rangeFor(kind, dateKey);
    const events = collectEvents(store, a, b, { includeDone });
    if (!events.length) { toast('No timed items in that range yet. Give a line a time first.'); return; }
    const filename = kind === 'day' ? `planner-${a}.ics` : kind === 'week' ? `planner-week-${a}.ics` : `planner-${a.slice(0, 7)}.ics`;
    if (go === 'copyFeed') {
      const v = el.querySelector('.ex-feed')?.value;
      if (!v) return;
      try { await navigator.clipboard.writeText(v); toast('Subscription link copied'); } catch { toast('Could not copy'); }
      return;
    }
    try {
      await providers[go].export(events, { filename, calName: 'Mom.OS', alarmMinutes });
      closePopover();
      toast(`${events.length} event${events.length === 1 ? '' : 's'} exported. Open the file to add to Calendar.`);
    } catch (err) { if (err?.name !== 'AbortError') toast('Export failed: ' + err.message); }
  });
}

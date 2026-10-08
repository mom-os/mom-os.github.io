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
    <p class="pop-help">Exports timed lines as an <b>.ics</b> file (Central time). Open it on your iPhone or Mac to add the events to iCloud Calendar.</p>
    <div class="seg" role="radiogroup">
      ${['day', 'week', 'month'].map((k) => `<button class="seg-btn ${k === kind ? 'on' : ''}" data-k="${k}" role="radio" aria-checked="${k === kind}">
        This ${k}<small>${count(k)} timed</small></button>`).join('')}
    </div>
    <p class="pop-sub">${esc(rangeLabel(kind, dateKey))}</p>
    <label class="chk"><input type="checkbox" id="ex-alarm" checked> 10-minute heads-up reminders</label>
    <label class="chk"><input type="checkbox" id="ex-done"> Include things already checked off</label>
    <div class="pop-row">
      ${providers.icsShare.available ? '<button class="btn ghost" data-go="icsShare">Share…</button>' : ''}
      <button class="btn primary" data-go="icsDownload">Download .ics</button>
    </div>
    <div class="pop-later"><b>Coming later:</b> ${esc(providers.subscriptionFeed.label)} · ${esc(providers.caldav.label)}</div>`;
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
    try {
      await providers[go].export(events, { filename, calName: 'My Planner', alarmMinutes });
      closePopover();
      toast(`${events.length} event${events.length === 1 ? '' : 's'} exported. Open the file to add to Calendar.`);
    } catch (err) { if (err?.name !== 'AbortError') toast('Export failed: ' + err.message); }
  });
}

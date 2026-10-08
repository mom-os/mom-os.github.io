// STYLE tab: the customization studio. Every control writes to settings.style;
// the whole app (and the live preview) restyles instantly via CSS variables.
import { PRESETS, QUOTE_LIBRARY, QUOTE_CATS, PATTERNS, STOCKS, DAY_LAYOUTS } from '../style/presets.js';
import { LOOKS, applyLook } from '../style/looks.js';
import { fontsFor } from '../style/fonts.js';
import { PACKS, EMOJI, stickerHTML } from '../style/stickers.js';
import { themeById, deriveVars, varsToCss, duplicateTheme, defaultStyle, quotePool,
  exportStylePayload, importStylePayload, BG_KEY, brandHTML } from '../style/engine.js';
import { PALETTE, defaultTemplates } from '../templates.js';
import { defaultState } from '../store.js';
import { todayKey, addDays, isWeekend } from '../dates.js';
import { icon, confirmSheet } from '../ui.js';
import { esc, uid } from '../util.js';
import { quoteFor } from './shared.js';

const PANELS = [
  ['looks', 'Looks'], ['themes', 'Themes'], ['colors', 'Colors'], ['fonts', 'Fonts'], ['stickers', 'Stickers'],
  ['words', 'Quotes & header'], ['layout', 'Layout'], ['paper', 'Paper'], ['share', 'Share & reset'], ['planner', 'Planner setup'],
];
const WORDMARKS = [
  ['a', 'Geometric caps', 'Bold Montserrat · MOM.OS · tight tracking'],
  ['b', 'Editorial serif', 'Playfair · Mom.OS · accent period'],
  ['c', 'Modern monogram', 'DM Sans · Mom.OS · M mark'],
  ['d', 'Quiet grotesk', 'Figtree · mom.os · square mark'],
];
const COLOR_FIELDS = [['accent', 'Accent', 'Banner, checkmarks, buttons'], ['secondary', 'Secondary', 'Tabs, today, highlights'],
  ['desk', 'Background', 'Behind the pages'], ['page', 'Paper', 'The pages themselves'], ['text', 'Text', 'Your ink color'], ['script', 'Quote ink', 'Handwritten quote']];

// ---------- small renderers ----------
function themeVarsAttr(t) { return t.css ? `data-theme="${t.id}"` : `data-theme="custom" style="${varsToCss(deriveVars(t.colors))}"`; }
function themeCard(t, current) {
  const dots = [3, 8, 9, 12, 17, 22, 24];
  return `<button class="theme-card ${t.id === current ? 'on' : ''}" data-pick="${t.id}" ${themeVarsAttr(t)} aria-pressed="${t.id === current}">
    <div class="tp-mini"><div class="tp-tabs"><i></i><i></i><i></i><i></i></div>
      <div class="tp-page"><div class="tp-notes"><b>Notes</b>${'<i></i>'.repeat(5)}</div>
        <div class="tp-month"><div class="tp-ribbon">October</div>
          <div class="tp-grid">${Array.from({ length: 21 }, (_, i) => `<span>${dots.includes(i) ? `<em class="c-${['teal', 'blush', 'sage', 'lavender'][i % 4]}"></em>` : ''}</span>`).join('')}</div>
          <div class="tp-quote">Think big.</div></div></div></div>
    <div class="tp-info"><b>${esc(t.name)}</b>${t.custom ? '<small class="tp-mine">mine</small>' : ''}
      <span class="tp-state">${t.id === current ? `${icon.check} In use` : 'Use'}</span></div>
  </button>`;
}
const toggle = (key, on, label, sub = '') => `<button type="button" class="switch-row" role="switch" aria-checked="${!!on}" data-sw="${key}">
  <span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><i class="sw-ui" aria-hidden="true"></i></button>`;
const seg = (attr, options, cur) => `<div class="seg">${options.map(([v, l]) => `<button class="seg-btn ${String(v) === String(cur) ? 'on' : ''}" data-${attr}="${v}">${l}</button>`).join('')}</div>`;

// ---------- live preview ----------
const PV = {
  A: { title: "Today's Issues", color: 'blush', role: 'issues', lines: [['Finish brochure mockups', 1], ['Call pediatrician', 0], ['List 5 resale items', 0]] },
  B: { title: 'What Are We Eating', color: 'sage', role: 'meals', lines: [['Dinner: sheet-pan fajitas', 0]] },
  C: { title: 'Important Things To Do', color: 'teal', role: 'todo', lines: [['7:30a Work starts', 1], ['2p Client review call', 0], ['7p Bath + bedtime', 0, 'p:duck']] },
};
function pvSec(s, sticker) {
  return `<div class="pv-sec c-${s.color}"><div class="pv-sec-h"><i></i><b>${esc(s.title)}</b>${sticker ? stickerHTML(sticker) : ''}</div>
    ${s.lines.map(([t, d, stk]) => `<div class="pv-line ${d ? 'done' : ''}"><span class="pv-chk"></span>${stk ? stickerHTML(stk) : ''}<span>${esc(t)}</span></div>`).join('')}</div>`;
}
function previewHTML(ctx) {
  const st = ctx.store.style; const L = st.layout;
  const showStk = st.chrome === 'playful' || st.stickers?.showInMonth;
  const head = `<div class="pv-head"><span class="pv-num">8</span><span class="pv-dow">Thursday</span>${showStk ? stickerHTML('p:coffee') : ''}<span class="pv-quote">${esc(quoteFor(ctx, '2026-10-08'))}</span></div>`;
  let body;
  if (L.day === 'hourly') {
    body = `<div class="pv-hourly"><div class="pv-hours">${[['7a', 'Work starts', 1], ['8a'], ['9a'], ['10a'], ['11a'], ['12p'], ['1p'], ['2p', 'Client review call'], ['3p']].map(([h, t, d]) =>
      `<div class="pv-hour"><span>${h}</span>${t ? `<em class="${d ? 'done' : ''}"><span class="pv-chk"></span>${t}</em>` : ''}</div>`).join('')}</div><div>${pvSec(PV.A, showStk ? 'p:sparkle' : '')}${pvSec(PV.B)}</div></div>`;
  } else {
    const cols = L.day === 'columns' ? [[PV.A], [PV.B], [PV.C]] : L.day === 'stacked' ? [[PV.A, PV.C]] : [[PV.A, PV.B], [PV.C]];
    body = `<div class="pv-cols n${cols.length}">${cols.map((c) => `<div>${c.map((s) => pvSec(s, showStk && s.role === 'issues' ? 'p:sparkle' : '')).join('')}</div>`).join('')}</div>`;
  }
  return `<div class="pv" aria-label="Live preview">
    <div class="pv-top">${st.header.showMark ? '<span class="brand-mark"></span>' : ''}<span class="pv-brand">${brandHTML(st.header.title || 'Mom.OS', st.header.wordmark || 'a')}</span>
      <span class="pv-tabs"><i></i><i></i><i></i><i></i></span></div>
    <div class="pv-row">
      <div class="pv-page paper ${L.day === 'vertical' && L.spiral ? 'with-spine' : ''}">
        <div class="pv-band"></div>${head}${body}
        ${L.day === 'vertical' ? '<div class="spine pv-spine" aria-hidden="true"></div>' : ''}
      </div>
      ${L.notes ? '<div class="pv-notes notes-col"><b class="notes-label">Notes</b><i></i><i></i><i></i><i></i><i></i><i></i></div>' : ''}
    </div>
  </div>`;
}

// ---------- panels ----------

function panelLooks(ctx) {
  const st = ctx.store.style;
  const cur = st.lookId || 'custom';
  return `<h2 class="panel-title">Looks</h2>
    <p class="muted">A Look sets theme, type, chrome, quotes, binding and stickers together. Tweak anything afterward — your changes stay.</p>
    <div class="look-grid">${LOOKS.map((l) => {
      const on = cur === l.id;
      const sw = l.swatch.map((c) => `<i style="background:${c}"></i>`).join('');
      return `<button class="look-card ${on ? 'on' : ''}" data-look="${l.id}" aria-pressed="${on}">
        <div class="look-swatch">${sw}</div>
        <div class="look-body"><b>${esc(l.name)}</b><small>${esc(l.note)}</small>
          <div class="look-state">${on ? 'In use' : 'Apply'}</div></div>
      </button>`;
    }).join('')}</div>
    ${cur === 'custom' ? '<p class="note-box">You\'re on a custom mix. Pick a Look above to reset the bundle, or keep refining.</p>' : ''}`;
}
function panelThemes(ctx) {
  const st = ctx.store.style;
  const mine = st.customThemes;
  return `<h2 class="panel-title">Themes</h2>
    <p class="muted">Tap a look to try it on. Want it just right? Duplicate any theme and tweak every color.</p>
    <div class="theme-grid">${PRESETS.map((t) => themeCard(t, st.themeId)).join('')}</div>
    <h3 class="panel-sub">My themes</h3>
    ${mine.length ? `<div class="theme-grid">${mine.map((t) => themeCard(t, st.themeId)).join('')}</div>` : '<p class="muted">None yet. Make one below. It only takes a minute.</p>'}
    <button class="btn primary" data-a="new-theme">${icon.plus} Build a theme from the current one</button>`;
}
function panelColors(ctx) {
  const st = ctx.store.style; const t = themeById(st, st.themeId); const c = t.colors;
  return `<h2 class="panel-title">Colors</h2>
    ${t.custom ? `<label class="field"><span>Theme name</span><input class="c-name" value="${esc(t.name)}" maxlength="40"></label>`
      : `<p class="note-box">${icon.spark} You're on <b>${esc(t.name)}</b>, a built-in theme. Change any color and we'll save it as your own copy.</p>`}
    <div class="color-list">${COLOR_FIELDS.map(([k, label, sub]) => `<label class="color-row"><input type="color" data-color="${k}" value="${c[k] || c.accent}">
      <span><b>${label}</b><small>${sub}</small></span><code>${(c[k] || c.accent).toUpperCase()}</code></label>`).join('')}</div>
    <h3 class="panel-sub">Section colors</h3>
    <div class="sec-colors">${PALETTE.map((k) => `<label class="sec-color c-${k}"><input type="color" data-sec-color="${k}" value="${c.sections?.[k] || '#cccccc'}"><span>${k}</span></label>`).join('')}</div>
    <div class="menu-row">
      <button class="btn small" data-a="dup-theme">Duplicate</button>
      ${t.custom ? '<button class="btn small ghost danger" data-a="del-theme">Delete theme</button>' : ''}
    </div>`;
}
function fontTiles(ctx, cat, sample, opts = {}) {
  const pool = opts.pool || cat;
  const cur = ctx.store.style.fonts[cat] || 'auto';
  const autoStack = opts.autoStack || (cat === 'script' ? 'var(--font-script)' : cat === 'body' ? 'var(--font-ui)' : cat === 'brand' ? 'var(--font-brand)' : 'var(--font-head)');
  const autoName = opts.autoName || 'Theme default';
  const autoNote = opts.autoNote || (cat === 'brand' ? 'Clean geometric wordmark' : 'Matches the theme');
  const tile = (id, name, stack, note) => `<button class="font-tile ${cur === id ? 'on' : ''}" data-font-cat="${cat}" data-font="${id}">
    <span class="ft-sample" style="font-family:${esc(stack)}">${cat === 'brand' ? brandHTML(sample) : esc(sample)}</span><span class="ft-name">${esc(name)}</span><small>${esc(note)}</small></button>`;
  return `<div class="font-grid ${cat}">${tile('auto', autoName, autoStack, autoNote)}
    ${fontsFor(pool).map((f) => tile(f.id, f.name, f.stack, f.note)).join('')}</div>`;
}
function panelFonts(ctx) {
  return `<h2 class="panel-title">Fonts</h2>
    <h3 class="panel-sub">App name</h3>
    <p class="muted">The Mom.OS wordmark in the header. Independent of the handwritten quote font.</p>
    ${fontTiles(ctx, 'brand', 'Mom.OS', { pool: 'heading', autoName: 'Mom.OS default', autoNote: 'Josefin Sans · clean & readable' })}
    <h3 class="panel-sub">Headings & labels</h3>${fontTiles(ctx, 'heading', "TODAY'S ISSUES")}
    <h3 class="panel-sub">Body text</h3>${fontTiles(ctx, 'body', 'Call pediatrician at 2pm')}
    <h3 class="panel-sub">Handwriting / script</h3>${fontTiles(ctx, 'script', 'Think big. Start small.')}`;
}
function panelStickers(ctx) {
  const st = ctx.store.style.stickers;
  return `<h2 class="panel-title">Stickers</h2>
    <p class="muted">Decorate days, sections and single lines. Add them from the <b>✦ +</b> next to a day's date, a section's <b>⋯</b> menu, or a line's clock button.</p>
    ${toggle('stk-month', st.showInMonth, 'Show day stickers on the month', 'Little stickers in the month grid')}
    ${Object.entries(PACKS).map(([id, p]) => `<div class="pack">
      <label class="pack-h"><input type="checkbox" class="pack-on" data-pack="${id}" ${st.packs.includes(id) ? 'checked' : ''}><b>${esc(p.name)}</b><small>${Object.keys(p.items).length} stickers</small></label>
      <div class="pack-sheet">${Object.keys(p.items).map((k) => stickerHTML('p:' + k)).join('')}</div></div>`).join('')}
    <div class="pack"><div class="pack-h"><b>Emoji</b><small>Always on · or type any emoji</small></div>
      <div class="pack-sheet emoji">${Object.values(EMOJI).flat().slice(0, 30).map((e) => stickerHTML('e:' + e)).join('')}</div></div>`;
}
function panelWords(ctx) {
  const st = ctx.store.style; const q = st.quotes; const wm = st.header.wordmark || 'a';
  return `<h2 class="panel-title">Quotes & header</h2>
    <label class="field"><span>App name</span><input class="hdr-title" value="${esc(st.header.title)}" maxlength="32" placeholder="Mom.OS"></label>
    ${toggle('hdr-mark', st.header.showMark, 'Show the brand mark')}
    <h3 class="panel-sub">Wordmark</h3>
    <p class="muted">Four professional treatments of Mom.OS. Default is A until you pick another.</p>
    <div class="wordmark-grid">${WORDMARKS.map(([id, name, note]) => {
      const preview = `<span class="brand-mark"></span><span class="brand-name">${brandHTML(st.header.title || 'Mom.OS', id)}</span>`;
      return `<button type="button" class="wm-card ${wm === id ? 'on' : ''}" data-wordmark="${id}" data-wordmark-preview="${id}">
        <div class="wm-lab">Option ${id.toUpperCase()} · ${esc(name)}</div>
        <div class="wm-preview" data-wordmark="${id}">${preview}</div>
        <p class="wm-note">${esc(note)}</p>
      </button>`;
    }).join('')}</div>
    <h3 class="panel-sub">Quote style</h3>
    ${seg('qdisplay', [['italic', 'Italic serif'], ['smallcaps', 'Small caps'], ['script', 'Handwritten']], q.display || 'italic')}
    <h3 class="panel-sub">Motivational quote</h3>
    ${seg('qmode', [['rotate', 'New one each day'], ['fixed', 'Keep one quote']], q.mode)}
    ${q.mode === 'fixed' ? `<label class="field"><span>Your quote</span><input class="q-fixed" value="${esc(q.fixed)}" maxlength="80"></label>
      <p class="muted">Or tap one below to use it.</p>` : `${toggle('q-lib', q.useLibrary, 'Include the quote library', 'Pick the moods you like')}
      ${q.useLibrary ? `<div class="chips">${Object.entries(QUOTE_CATS).map(([k, l]) => `<button class="chip ${q.cats.includes(k) ? 'on' : ''}" data-qcat="${k}">${l}</button>`).join('')}</div>` : ''}
      <p class="muted">${quotePool(st).length} quotes in rotation.</p>`}
    <h3 class="panel-sub">My own quotes</h3>
    <ul class="my-quotes">${q.custom.map((t, i) => `<li><button class="q-use" data-quse="${esc(t)}">${esc(t)}</button><button class="icon-btn mini" data-qdel="${i}" aria-label="Remove">${icon.x}</button></li>`).join('') || '<li class="muted">Write one below. It joins the rotation.</li>'}</ul>
    <div class="q-add"><input class="q-new" placeholder="Write your own…" maxlength="80" enterkeyhint="done"><button class="btn small primary" data-a="q-add">Add</button></div>
    <details class="q-library"><summary>Browse the library (${QUOTE_LIBRARY.length})</summary>
      <ul>${QUOTE_LIBRARY.map((x) => `<li><button class="q-use" data-quse="${esc(x.text)}"><span class="q-script">${esc(x.text)}</span><small>${QUOTE_CATS[x.cat]}</small></button></li>`).join('')}</ul></details>`;
}
function panelLayout(ctx) {
  const L = ctx.store.style.layout; const s = ctx.store.settings;
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
  return `<h2 class="panel-title">Layout</h2>
    <h3 class="panel-sub">Day page</h3>
    <div class="layout-grid">${DAY_LAYOUTS.map((l) => `<button class="layout-card ${L.day === l.id ? 'on' : ''}" data-layout="${l.id}">
      <span class="lc-art lc-${l.id}"><i></i><i></i><i></i><i></i></span><b>${l.name}</b><small>${l.note}</small></button>`).join('')}</div>
    ${L.day === 'hourly' ? `<div class="hour-range"><label class="field"><span>Timeline starts</span><select class="h-start">${hours.map((h) => `<option value="${h}" ${h === L.hourStart ? 'selected' : ''}>${hLabel(h)}</option>`).join('')}</select></label>
      <label class="field"><span>Timeline ends</span><select class="h-end">${hours.map((h) => `<option value="${h}" ${h === L.hourEnd ? 'selected' : ''}>${hLabel(h)}</option>`).join('')}</select></label></div>` : ''}
    <h3 class="panel-sub">Planner details</h3>
    ${toggle('l-spiral', L.spiral, 'Spiral binding', 'The coil down the middle of the spread')}
    ${toggle('l-notes', L.notes, 'Notes column', 'Lined notes on month and day pages')}
    <div class="field"><span>Week starts on</span>${seg('wstart', [[0, 'Sunday'], [1, 'Monday']], L.weekStart)}</div>
    <div class="field"><span>Text size</span>${seg('tsize', [['cozy', 'Cozy'], ['large', 'Larger']], s.textSize)}</div>`;
}
function panelPaper(ctx) {
  const p = ctx.store.style.paper;
  const theme = themeById(ctx.store.style, ctx.store.style.themeId);
  return `<h2 class="panel-title">Paper & background</h2>
    <h3 class="panel-sub">Page pattern</h3>
    <div class="texture-grid">${PATTERNS.map((t) => `<button class="texture-tile ${p.texture === t.id ? 'on' : ''}" data-texture="${t.id}">
      <span class="tx-swatch tx-${t.id} tx-${p.stock}"></span><b>${t.name}</b></button>`).join('')}</div>
    <h3 class="panel-sub">Paper stock</h3>
    <div class="texture-grid">${STOCKS.map((t) => `<button class="texture-tile ${p.stock === t.id ? 'on' : ''}" data-stock-pick="${t.id}">
      <span class="tx-swatch tx-${t.id} tx-${p.texture}"></span><b>${t.name}</b></button>`).join('')}</div>
    <h3 class="panel-sub">Background color</h3>
    <label class="color-row"><input type="color" class="desk-color" value="${p.desk || theme.colors.desk}"><span><b>Behind the pages</b><small>${p.desk ? 'Custom' : 'From your theme'}</small></span>
      ${p.desk ? '<button class="btn small ghost" data-a="desk-reset">Use theme color</button>' : ''}</label>
    <h3 class="panel-sub">Background photo</h3>
    <p class="muted">Use your own photo behind the planner. It's resized and saved on this device only.</p>
    <div class="menu-row"><label class="btn small file-btn">${icon.plus} ${p.hasImage ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/*" class="bg-file" hidden></label>
      ${p.hasImage ? '<button class="btn small ghost danger" data-a="bg-remove">Remove photo</button>' : ''}</div>
    ${p.hasImage ? `<label class="field"><span>Soften photo</span><input type="range" class="bg-dim" min="0" max="0.6" step="0.05" value="${p.imageDim}"></label>` : ''}`;
}
function panelShare() {
  return `<h2 class="panel-title">Share & reset</h2>
    <p class="muted">Save your whole look (theme, colors, fonts, quotes, layout, paper, stickers) as a little file. Send it to a friend, or keep it as a backup. Importing a file applies it right away.</p>
    <label class="chk"><input type="checkbox" class="ex-img"> Include my background photo (bigger file)</label>
    <div class="stack">
      <button class="btn primary" data-a="style-export">Download my style (.json)</button>
      <label class="btn file-btn">Import a style file<input type="file" accept="application/json,.json" class="style-import" hidden></label>
      <button class="btn ghost danger" data-a="style-reset">Reset style to default</button>
    </div>
    <p class="muted small">Reset only touches the look. Your days, notes and templates stay put. You can undo right after.</p>`;
}
function panelPlanner(ctx) {
  const { store } = ctx; const st = store.settings;
  const nextOf = (wkend) => { let k = todayKey(); while (isWeekend(k) !== wkend) k = addDays(k, 1); return k; };
  const anchorRows = (kind) => (st.anchors[kind] || []).map((a) => `
    <li data-anc="${a.id}" data-kind="${kind}"><input class="a-text" value="${esc(a.text)}" aria-label="Label">
      <button class="icon-btn mini" data-a="del-anc" aria-label="Remove">${icon.x}</button>
      <input type="time" class="a-time" value="${a.time || ''}" aria-label="Start"><span>to</span><input type="time" class="a-end" value="${a.end || ''}" aria-label="End (optional)"></li>`).join('');
  const tplSummary = (list) => `<ul class="tpl-list">${list.map((s) => `<li><span class="dot c-${s.color}"></span><b>${esc(s.title)}</b>${s.slots?.length ? ` <small>(${s.slots.map(esc).join(', ')})</small>` : ''}</li>`).join('')}</ul>`;
  return `<h2 class="panel-title">Planner setup</h2>
    <h3 class="panel-sub">Day anchors</h3>
    <p class="muted">Fixed parts of your day, shown softly in My Day (not exported, not checkable).</p>
    ${toggle('set-anchors', st.showAnchors, 'Show anchors')}
    <h3 class="panel-sub small">Weekdays</h3><ul class="anchor-list">${anchorRows('weekday')}</ul>
    <button class="btn small ghost" data-a="add-anc" data-kind="weekday">${icon.plus} Add weekday anchor</button>
    <h3 class="panel-sub small">Weekends</h3><ul class="anchor-list">${anchorRows('weekend')}</ul>
    <button class="btn small ghost" data-a="add-anc" data-kind="weekend">${icon.plus} Add weekend anchor</button>
    <h3 class="panel-sub">Day templates</h3>
    <p class="muted">Open any day, arrange its sections, then tap “Save as weekday/weekend template”. Untouched days update automatically.</p>
    <b class="small-h">Weekday (Mon–Fri)</b>${tplSummary(store.templates.weekday)}
    <div class="menu-row"><a class="btn small" href="#/day/${nextOf(false)}">Open a weekday</a><button class="btn small ghost" data-a="reset-tpl" data-kind="weekday">Reset to default</button></div>
    <b class="small-h">Weekend (Sat & Sun)</b>${tplSummary(store.templates.weekend)}
    <div class="menu-row"><a class="btn small" href="#/day/${nextOf(true)}">Open a weekend day</a><button class="btn small ghost" data-a="reset-tpl" data-kind="weekend">Reset to default</button></div>
    <h3 class="panel-sub">Your data</h3>
    <p class="muted">Saved privately on this device only (no account yet).</p>
    <div class="stack">
      ${store.state.meta.sampleActive ? '<button class="btn" data-a="clear-sample">Clear sample data</button>' : '<button class="btn ghost" data-a="load-sample">Load sample days again</button>'}
      <button class="btn ghost" data-a="backup">Download full backup (.json)</button>
      <label class="btn ghost file-btn">Restore from backup<input type="file" accept="application/json,.json" class="restore" hidden></label>
      <button class="btn danger ghost" data-a="erase">Erase everything</button>
    </div>
    <h3 class="panel-sub">Put it on your iPhone</h3>
    <p class="muted">Open this page in Safari → Share → <b>Add to Home Screen</b>. It opens full-screen and works offline.</p>`;
}
const RENDER = { looks: panelLooks, themes: panelThemes, colors: panelColors, fonts: panelFonts, stickers: panelStickers, words: panelWords, layout: panelLayout, paper: panelPaper, share: panelShare, planner: panelPlanner };

// ---------- helpers ----------
function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => reject(new Error('That image could not be opened'));
    img.src = url;
  });
}

// ---------- main ----------
export function renderStudio(view, ctx, arg) {
  const { store } = ctx;
  const panel = RENDER[arg] ? arg : (ctx.studioPanel || 'looks');
  ctx.studioPanel = panel;
  const showPv = ctx.studioPreview !== false;

  view.innerHTML = `
  <section class="studio">
    <nav class="studio-nav" aria-label="Style studio sections">
      <p class="script-title studio-title">Style</p>
      ${PANELS.map(([id, l]) => `<a class="snav ${id === panel ? 'on' : ''}" href="#/style/${id}">${l}</a>`).join('')}
    </nav>
    <div class="studio-panel paper panel-${panel}">${RENDER[panel](ctx)}</div>
    <aside class="studio-preview ${showPv ? '' : 'collapsed'}">
      <div class="pv-bar"><b>Live preview</b><button class="btn small ghost" data-a="pv-toggle">${showPv ? 'Hide' : 'Show'}</button></div>
      <div class="pv-holder">${previewHTML(ctx)}</div>
    </aside>
  </section>`;

  const style = store.style;
  const live = () => { ctx.applyStyleOnly(); const h = view.querySelector('.pv-holder'); if (h) h.innerHTML = previewHTML(ctx); };
  const silent = (fn) => { store.updateStyle(fn, { silent: true }); live(); };
  const commit = (fn) => store.updateStyle(fn); // full re-render

  // editing a built-in theme's colors makes a custom copy first
  const ensureCustom = () => {
    const t = themeById(style, style.themeId);
    if (t.custom) return t;
    const copy = duplicateTheme(style, t.id); style.themeId = copy.id;
    ctx.toast(`Saved as “${copy.name}” so the original stays intact`);
    return copy;
  };

  view.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-pick],[data-look],[data-wordmark],[data-font],[data-layout],[data-texture],[data-qmode],[data-qdisplay],[data-qcat],[data-quse],[data-qdel],[data-wstart],[data-tsize],[data-stock-pick],[data-sw],[data-a]');
    if (!el || !view.contains(el)) return; // never match attributes on <html>
    const d = el.dataset;
    if (d.look) return commit((s) => { applyLook(s, d.look); });
    if (d.wordmark) return commit((s) => { s.header.wordmark = d.wordmark; s.lookId = 'custom'; });
    if (d.pick) return commit((s) => { s.themeId = d.pick; s.lookId = 'custom'; });
    if (d.font) return commit((s) => { s.fonts[d.fontCat] = d.font; s.lookId = 'custom'; });
    if (d.layout) return commit((s) => { s.layout.day = d.layout; });
    if (d.texture) return commit((s) => { s.paper.texture = d.texture; });
    if (d.stockPick) return commit((s) => { s.paper.stock = d.stockPick; });
    if (d.qmode) return commit((s) => { s.quotes.mode = d.qmode; });
    if (d.qdisplay) return commit((s) => { s.quotes.display = d.qdisplay; s.lookId = 'custom'; });
    if (d.qcat) return commit((s) => { const c = s.quotes.cats; s.quotes.cats = c.includes(d.qcat) ? c.filter((x) => x !== d.qcat) : [...c, d.qcat]; });
    if (d.quse !== undefined) { commit((s) => { s.quotes.mode = 'fixed'; s.quotes.fixed = d.quse; }); return ctx.toast('Quote set. Switch back to “New one each day” anytime.'); }
    if (d.qdel !== undefined) return commit((s) => { s.quotes.custom.splice(Number(d.qdel), 1); });
    if (d.wstart !== undefined) return commit((s) => { s.layout.weekStart = Number(d.wstart); });
    if (d.tsize) return store.updateSettings({ textSize: d.tsize });
    if (d.sw) {
      const on = el.getAttribute('aria-checked') !== 'true';
      const set = { 'stk-month': (s) => { s.stickers.showInMonth = on; }, 'hdr-mark': (s) => { s.header.showMark = on; }, 'q-lib': (s) => { s.quotes.useLibrary = on; },
        'l-spiral': (s) => { s.layout.spiral = on; }, 'l-notes': (s) => { s.layout.notes = on; } }[d.sw];
      if (set) return commit(set);
      if (d.sw === 'set-anchors') return store.updateSettings({ showAnchors: on });
    }
    switch (d.a) {
      case 'q-add': return addQuote();
      case 'pv-toggle': ctx.studioPreview = !showPv; return ctx.rerender();
      case 'new-theme': { commit((s) => { const t = duplicateTheme(s, s.themeId, 'My new theme'); s.themeId = t.id; }); return ctx.go('#/style/colors'); }
      case 'dup-theme': return commit((s) => { const t = duplicateTheme(s, s.themeId); s.themeId = t.id; });
      case 'del-theme': {
        if (!(await confirmSheet(el, 'Delete this theme?', 'Delete'))) return;
        return ctx.withUndo('Theme deleted', () => commit((s) => { s.customThemes = s.customThemes.filter((t) => t.id !== s.themeId); s.themeId = 'studio'; s.lookId = 'custom'; }));
      }
      case 'desk-reset': return commit((s) => { s.paper.desk = ''; });
      case 'bg-remove': localStorage.removeItem(BG_KEY); return commit((s) => { s.paper.hasImage = false; });
      case 'style-export': {
        const payload = exportStylePayload(style, { includeImage: view.querySelector('.ex-img')?.checked });
        const name = (themeById(style, style.themeId).name || 'style').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        download(`planner-style-${name}.json`, JSON.stringify(payload, null, 2)); return ctx.toast('Style file downloaded');
      }
      case 'style-reset':
        return ctx.withUndo('Style reset to default', () => { localStorage.removeItem(BG_KEY); commit((s) => { const keep = s.customThemes; Object.assign(s, defaultStyle(), { customThemes: keep }); }); });
      // planner setup
      case 'clear-sample': return ctx.clearSample();
      case 'load-sample': return ctx.loadSample();
      case 'reset-tpl': return ctx.withUndo(`${d.kind} template reset`, () => store.setTemplate(d.kind, defaultTemplates()[d.kind]));
      case 'add-anc': store.settings.anchors[d.kind] = [...(store.settings.anchors[d.kind] || []), { id: uid('anc'), time: '12:00', end: null, text: 'New anchor' }]; return store.commit('settings');
      case 'del-anc': { const li = el.closest('[data-anc]'); store.settings.anchors[li.dataset.kind] = store.settings.anchors[li.dataset.kind].filter((x) => x.id !== li.dataset.anc); return store.commit('settings'); }
      case 'backup': return download(`planner-backup-${todayKey()}.json`, JSON.stringify(store.state, null, 2));
      case 'erase':
        if (await confirmSheet(el, 'Erase every day, note and setting on this device?', 'Erase')) {
          ctx.withUndo('Everything erased', () => { const fresh = defaultState(); fresh.meta.seeded = true; store.restore(fresh); });
        }
    }
  });

  // live (silent) edits: colors, text fields, sliders
  view.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.color) { silent((s) => { const th = ensureCustom(); th.colors[t.dataset.color] = t.value; }); t.closest('.color-row').querySelector('code').textContent = t.value.toUpperCase(); }
    else if (t.dataset.secColor) silent((s) => { const th = ensureCustom(); th.colors.sections = { ...th.colors.sections, [t.dataset.secColor]: t.value }; });
    else if (t.classList.contains('c-name')) silent(() => { themeById(style, style.themeId).name = t.value || 'My theme'; });
    else if (t.classList.contains('hdr-title')) silent((s) => { s.header.title = t.value; });
    else if (t.classList.contains('q-fixed')) silent((s) => { s.quotes.fixed = t.value; });
    else if (t.classList.contains('desk-color')) silent((s) => { s.paper.desk = t.value; });
    else if (t.classList.contains('bg-dim')) silent((s) => { s.paper.imageDim = Number(t.value); });
  });
  view.addEventListener('change', async (e) => {
    const t = e.target; const c = t.classList;
    if (t.dataset.color || t.dataset.secColor || c.contains('desk-color')) return ctx.rerender(); // refresh theme cards/labels once picking is done
    if (c.contains('pack-on')) return commit((s) => { const p = t.dataset.pack; s.stickers.packs = t.checked ? [...new Set([...s.stickers.packs, p])] : s.stickers.packs.filter((x) => x !== p); });
    if (c.contains('h-start') || c.contains('h-end')) return commit((s) => {
      const a = Number(view.querySelector('.h-start').value), b = Number(view.querySelector('.h-end').value);
      s.layout.hourStart = Math.min(a, b); s.layout.hourEnd = Math.max(a, b);
    });
    if (c.contains('bg-file') && t.files[0]) {
      try {
        const data = await resizeImage(t.files[0]);
        try { localStorage.setItem(BG_KEY, data); } catch { return ctx.toast('That photo is too big to store on this device. Try a smaller one.'); }
        commit((s) => { s.paper.hasImage = true; }); ctx.toast('Background photo set');
      } catch (err) { ctx.toast(err.message); }
    }
    if (c.contains('style-import') && t.files[0]) {
      try {
        const data = JSON.parse(await t.files[0].text());
        const next = importStylePayload(style, data);
        ctx.withUndo('Style imported', () => commit((s) => { Object.assign(s, next); }));
      } catch (err) { ctx.toast('Could not import: ' + err.message); }
    }
    if (c.contains('restore') && t.files[0]) {
      try { const data = JSON.parse(await t.files[0].text()); if (!data.days) throw new Error('not a planner backup');
        ctx.withUndo('Backup restored', () => store.restore(data)); } catch (err) { ctx.toast('Could not read that file: ' + err.message); }
    }
    const li = t.closest('[data-anc]');
    if (li) {
      const anc = store.settings.anchors[li.dataset.kind].find((x) => x.id === li.dataset.anc);
      if (c.contains('a-time')) anc.time = t.value || anc.time;
      if (c.contains('a-end')) anc.end = t.value || null;
      if (c.contains('a-text')) anc.text = t.value;
      store.commit('settings', { silent: true });
    }
  });
  const addQuote = () => { const v = view.querySelector('.q-new')?.value.trim(); if (v) commit((s) => { s.quotes.custom.push(v); }); };
  view.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('q-new')) { e.preventDefault(); addQuote(); } });
}

// Applies the user's style (theme, fonts, paper, layout toggles, header) to the document.
import { PRESETS, QUOTE_LIBRARY } from './presets.js';
import { fontById, injectFontFaces } from './fonts.js';
import { LOOKS, applyLook, isLegacyStockDefault, lookById } from './looks.js';
import { clone, uid, esc } from '../util.js';

export { LOOKS, applyLook, lookById } from './looks.js';

export const BG_KEY = 'jb-planner:bg-image';

export function defaultStyle() {
  return {
    lookId: 'studio',
    themeId: 'studio',
    chrome: 'refined',
    customThemes: [],
    fonts: { heading: 'cormorant', body: 'dmsans', script: 'cormorant', brand: 'montserrat' },
    header: { title: 'Mom.OS', showMark: true, wordmark: 'a' },
    quotes: { mode: 'rotate', fixed: 'Think big. Start small.', useLibrary: true, cats: ['motivation', 'calm', 'mom', 'hustle', 'adhd'], custom: [], display: 'italic' },
    layout: { day: 'vertical', spiral: false, notes: true, weekStart: 0, hourStart: 6, hourEnd: 22 },
    paper: { texture: 'plain', stock: 'smooth', desk: '', hasImage: false, imageDim: 0.25 },
    stickers: { showInMonth: false, packs: ['sweet', 'mom', 'hustle', 'seasons', 'plant', 'business', 'resale', 'boudoir'], recent: [] },
  };
}

/** deep-merge saved style over defaults so new options appear for old saves */
export function migrateStyle(saved, legacy = {}) {
  const d = defaultStyle();
  if (!saved) {
    const out = defaultStyle();
    if (legacy.theme) out.themeId = legacy.theme;
    if (legacy.quote) { out.quotes.mode = 'fixed'; out.quotes.fixed = legacy.quote; out.quotes.custom = [legacy.quote]; }
    return out;
  }
  const wasStock = isLegacyStockDefault(saved);
  const s = saved;
  const out = { ...d, ...s };
  for (const k of ['fonts', 'header', 'quotes', 'layout', 'paper', 'stickers']) out[k] = { ...d[k], ...(s[k] || {}) };
  if (wasStock) {
    applyLook(out, 'studio');
  } else if (!s.lookId) {
    out.lookId = 'custom';
  }
  if (!out.header.wordmark) out.header.wordmark = 'a';
  if (!out.quotes.display) out.quotes.display = (out.themeId === 'blush' || out.chrome === 'playful') ? 'script' : 'italic';
  if (!out.chrome) out.chrome = out.lookId === 'sweet' || out.themeId === 'blush' ? 'playful' : 'refined';
  // Rebrand: only replace previous shipped defaults; keep user-customized names.
  const ht = (out.header.title || '').trim().toLowerCase();
  if (ht === 'my planner' || ht === 'momos') out.header.title = 'Mom.OS';
  return out;
}

export const allThemes = (style) => [...PRESETS, ...style.customThemes];
export const themeById = (style, id) => allThemes(style).find((t) => t.id === id) || PRESETS[0];

// ---------- color math ----------
function hexToRgb(hex) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrastInk = (bg, dark = '#2b2629', light = '#ffffff') => (luminance(bg) > 0.48 ? dark : light);
const mix = (a, pct, b) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/** Full CSS variable set from a handful of picked colors. */
export function deriveVars(c) {
  const isDark = luminance(c.page) < 0.2;
  const refined = true; // tab derivation stays usable; chrome mode overrides in CSS
  const v = {
    '--desk': c.desk, '--page': c.page, '--page-2': mix(c.page, 94, c.text), '--page-edge': mix(c.desk, 85, c.text),
    '--ink': c.text, '--ink-soft': mix(c.text, 62, c.page), '--ink-faint': mix(c.text, 36, c.page),
    '--line': isDark ? mix(c.text, 13, c.page) : mix(c.text, 12, c.page),
    '--grid': isDark ? mix(c.text, 20, c.page) : mix(c.text, 16, c.page),
    '--accent': c.accent, '--accent-strong': mix(c.accent, 80, c.text), '--accent-ink': contrastInk(c.accent),
    '--accent-soft': mix(c.accent, isDark ? 16 : 14, c.page),
    '--tab-1': mix(c.secondary, 50, c.page), '--tab-2': c.secondary, '--tab-3': mix(c.secondary, 22, c.page), '--tab-4': mix(c.accent, 40, c.page),
    '--tab-ink': isDark ? c.page : c.text,
    '--script': c.script || c.accent, '--today': c.secondary, '--today-ink': contrastInk(c.secondary),
    '--spine-ring': isDark ? '#b48f5e' : '#c9a27c', '--spine-ring-2': isDark ? '#5a4a38' : '#f1dcc4',
    '--shadow': isDark ? '0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35)' : '0 1px 2px rgba(40,36,32,.04), 0 6px 20px rgba(40,36,32,.06)',
    '--radius': '8px',
    'color-scheme': isDark ? 'dark' : 'light',
  };
  for (const [k, val] of Object.entries(c.sections || {})) v[`--c-${k}`] = val;
  return v;
}
export const varsToCss = (vars) => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

// ---------- brand / wordmark ----------
const WORDMARK_CASE = { a: 'upper', b: 'title', c: 'title', d: 'lower' };

/** Escape title, apply wordmark casing, accent periods. */
export function brandHTML(title, wordmark = 'a') {
  let t = String(title || 'Mom.OS');
  const mode = WORDMARK_CASE[wordmark] || 'title';
  if (mode === 'upper') t = t.toUpperCase();
  else if (mode === 'lower') t = t.toLowerCase();
  else {
    // title-ish: Mom.OS if it looks like the default
    if (/^mom\.os$/i.test(t)) t = 'Mom.OS';
  }
  return esc(t).replace(/\./g, '<span class="brand-dot">.</span>');
}

// ---------- apply ----------
export function applyStyle(settings) {
  injectFontFaces();
  const st = settings.style; const root = document.documentElement;
  const theme = themeById(st, st.themeId);
  root.dataset.theme = theme.css ? theme.id : 'custom';
  root.dataset.chrome = st.chrome || 'refined';
  root.dataset.wordmark = st.header?.wordmark || 'a';
  root.dataset.quote = st.quotes?.display || 'italic';
  root.dataset.look = st.lookId || 'custom';
  root.removeAttribute('style');
  if (!theme.css) for (const [k, v] of Object.entries(deriveVars(theme.colors))) root.style.setProperty(k, v);
  const f = st.fonts;
  const head = fontById(f.heading), body = fontById(f.body), script = fontById(f.script), brandF = fontById(f.brand);
  if (head) { root.style.setProperty('--font-head', head.stack); root.style.setProperty('--font-label', head.stack); }
  if (body) root.style.setProperty('--font-ui', body.stack);
  if (script) root.style.setProperty('--font-script', script.stack);
  if (brandF) root.style.setProperty('--font-brand', brandF.stack);
  else root.style.removeProperty('--font-brand');
  if (st.paper.desk) root.style.setProperty('--desk', st.paper.desk);
  root.dataset.paper = st.paper.texture;
  root.dataset.stock = st.paper.stock;
  root.dataset.size = settings.textSize;
  root.dataset.dark = luminance(theme.colors.page) < 0.2 ? '1' : '0';
  root.classList.toggle('no-spiral', !st.layout.spiral);
  root.classList.toggle('no-notes', !st.layout.notes);
  const img = st.paper.hasImage ? localStorage.getItem(BG_KEY) : null;
  root.classList.toggle('has-bg-image', !!img);
  if (img) root.style.setProperty('--bg-image', `linear-gradient(rgba(0,0,0,${st.paper.imageDim}), rgba(0,0,0,${st.paper.imageDim})), url("${img}")`);
  const wm = st.header.wordmark || 'a';
  const brand = document.querySelector('.brand-name');
  if (brand) brand.innerHTML = brandHTML(st.header.title || 'Mom.OS', wm);
  const mark = document.querySelector('.brand-mark'); if (mark) mark.hidden = !st.header.showMark;
  document.title = st.header.title ? st.header.title.replace(/^./, (c) => c.toUpperCase()) : 'Mom.OS';
  const desk = st.paper.desk || theme.colors.desk;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', desk);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', luminance(desk) < 0.2 ? 'black-translucent' : 'default');
}

// ---------- quotes ----------
export function quotePool(st) {
  const q = st.quotes;
  const lib = q.useLibrary ? QUOTE_LIBRARY.filter((x) => q.cats.includes(x.cat)).map((x) => x.text) : [];
  const pool = [...lib, ...q.custom.filter((t) => t.trim())];
  return pool.length ? pool : ['Think big. Start small.'];
}

// ---------- custom theme helpers ----------
export function duplicateTheme(style, id, name) {
  const base = themeById(style, id);
  const t = { id: uid('th'), name: name || `My ${base.name}`, note: 'Custom theme', colors: clone(base.colors), custom: true };
  style.customThemes.push(t);
  return t;
}

// ---------- share: export / import ----------
export function exportStylePayload(style, { includeImage = false } = {}) {
  const out = { type: 'jb-planner-style', version: 1, exportedAt: new Date().toISOString(), style: clone(style) };
  out.style.stickers.recent = [];
  if (includeImage && style.paper.hasImage) out.backgroundImage = localStorage.getItem(BG_KEY);
  else out.style.paper.hasImage = false;
  return out;
}
export function importStylePayload(current, data) {
  if (!data || data.type !== 'jb-planner-style' || !data.style) throw new Error("That file isn't a planner style");
  const next = migrateStyle(data.style);
  const ids = new Set(next.customThemes.map((t) => t.id));
  next.customThemes = [...next.customThemes, ...current.customThemes.filter((t) => !ids.has(t.id))];
  if (data.backgroundImage) { try { localStorage.setItem(BG_KEY, data.backgroundImage); next.paper.hasImage = true; } catch { next.paper.hasImage = false; } }
  else next.paper.hasImage = current.paper.hasImage && !!localStorage.getItem(BG_KEY) && false;
  return next;
}

import { clone, uid } from './util.js';
import { instantiate, defaultTemplates, ensureDayExtras } from './templates.js';
import { ensurePlanSettings } from './plan.js';
import { defaultStyle, migrateStyle } from './style/engine.js';

const nowIso = () => new Date().toISOString();

/**
 * Persistence is behind an adapter so a backend (REST, Supabase, CloudKit…)
 * can replace localStorage later without touching the views.
 * Adapter contract: load() -> state|null, save(state) -> void.
 */
export class LocalStorageAdapter {
  constructor(key = 'jb-planner:v1') { this.key = key; }
  load() {
    try { const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) : null; }
    catch (e) { console.warn('planner: could not read saved data', e); return null; }
  }
  save(state) {
    try { localStorage.setItem(this.key, JSON.stringify(state)); }
    catch (e) { console.warn('planner: could not save', e); }
  }
}

export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: {
      textSize: 'cozy',               // cozy | large
      style: defaultStyle(),          // everything the Style studio controls (see style/engine.js)
      showAnchors: true,              // show work/home anchors on weekdays in My Day
      plan: 'free',                   // free | pro (Stripe later); owner email always unlocked
      foundingMom: false,
      foundingInterest: false,
      retention: {
        streakCount: 0,
        streakLastDay: null,
        sundayPromptDismissedWeek: null,
        eodNudgeDismissedDay: null,
        seasonalBannerDismissed: null,
      },
      anchors: {
        weekday: [
          { id: 'anc_work', time: '07:30', end: '16:30', text: 'Work (design)' },
          { id: 'anc_home', time: '17:00', end: null, text: 'Home with the kiddos' },
        ],
        weekend: [],
      },
    },
    templates: { ...defaultTemplates(), listTemplates: [] },
    days: {},          // 'YYYY-MM-DD' -> day
    monthNotes: {},    // 'YYYY-MM' -> [{id,text,sample?}]
    meta: { seeded: false, sampleActive: false, createdAt: Date.now() },
  };
}

function migrate(s) {
  const base = defaultState();
  if (!s || typeof s !== 'object') return base;
  // shallow-merge new settings keys so older saves keep working
  const legacy = { theme: s.settings?.theme, quote: s.settings?.quote };
  s.settings = { ...base.settings, ...(s.settings || {}) };
  s.settings.style = migrateStyle(s.settings.style && s.settings.style.layout ? s.settings.style : null, legacy);
  delete s.settings.theme; delete s.settings.quote;
  ensurePlanSettings(s.settings);
  s.templates = { ...base.templates, ...(s.templates || {}) };
  if (!Array.isArray(s.templates.listTemplates)) s.templates.listTemplates = [];
  s.days ||= {}; s.monthNotes ||= {}; s.meta = { ...base.meta, ...(s.meta || {}) };
  s.version = SCHEMA_VERSION;
  return s;
}

export class Store {
  constructor(adapter = new LocalStorageAdapter()) {
    this.adapter = adapter;
    this.state = migrate(adapter.load());
    this.listeners = new Set();
    this.virtual = new Map(); // un-saved days rendered from templates (stable ids until first edit)
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(reason) { for (const fn of this.listeners) fn(reason); }
  commit(reason = 'change', { silent = false } = {}) {
    this.adapter.save(this.state);
    if (!silent) this.emit(reason);
  }

  get settings() { return this.state.settings; }
  get templates() { return this.state.templates; }

  hasDay(key) { return !!this.state.days[key]; }
  /** Returns the saved day, or a template-based preview that becomes real on first edit. */
  getDay(key) {
    if (this.state.days[key]) return ensureDayExtras(this.state.days[key]);
    if (!this.virtual.has(key)) this.virtual.set(key, ensureDayExtras(instantiate(this.state.templates, key)));
    return this.virtual.get(key);
  }
  mutateDay(key, fn, opts) {
    const day = this.getDay(key);
    if (!this.state.days[key]) { this.state.days[key] = day; this.virtual.delete(key); }
    fn(day);
    ensureDayExtras(day);
    day.updatedAt = nowIso();
    this.commit('day', opts);
    return day;
  }
  get listTemplates() { return this.state.templates.listTemplates || []; }
  setListTemplates(list, opts) {
    this.state.templates.listTemplates = list;
    this.state.templates.updatedAt = nowIso();
    this.commit('templates', opts);
  }
  resetDay(key) {
    delete this.state.days[key]; this.virtual.delete(key);
    this.commit('day');
  }
  setTemplate(kind, blueprint) {
    this.state.templates[kind] = blueprint;
    this.state.templates.updatedAt = nowIso();
    this.virtual.clear(); // un-edited days pick up the new template
    this.commit('templates');
  }
  updateSettings(patch) {
    Object.assign(this.state.settings, patch);
    this.state.settings.updatedAt = nowIso();
    this.commit('settings');
  }
  get style() { return this.state.settings.style; }
  /** mutate the style object; silent=true skips the re-render (we still re-apply CSS) */
  updateStyle(fn, opts) {
    fn(this.state.settings.style);
    this.state.settings.updatedAt = nowIso();
    this.commit('style', opts);
  }

  getMonthNotes(mk) { return this.state.monthNotes[mk] || []; }
  setMonthNotes(mk, list, opts) {
    this.state.monthNotes[mk] = list;
    this.state.meta.monthNotesUpdatedAt = this.state.meta.monthNotesUpdatedAt || {};
    this.state.meta.monthNotesUpdatedAt[mk] = nowIso();
    this.commit('monthNotes', opts);
  }

  snapshot() { return clone(this.state); }
  restore(snap) { this.state = migrate(clone(snap)); this.virtual.clear(); this.commit('restore'); }

  findItem(key, itemId) {
    const day = this.getDay(key);
    for (const s of day.sections) { const it = s.items.find((i) => i.id === itemId); if (it) return { day, section: s, item: it }; }
    return null;
  }
}

/** Only lines with words in them count (empty meal slots don't). */
export const filled = (items) => items.filter((i) => (i.text || '').trim());
export function dayStats(day) {
  let total = 0, done = 0;
  for (const s of day.sections) for (const i of filled(s.items)) { total++; if (i.done) done++; }
  return { total, done };
}
export { uid };

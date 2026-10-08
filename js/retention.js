/**
 * Habit / retention helpers for Mom.OS — calm, low-guilt.
 */
import { todayKey, addDays, fromKey, isWeekend, nowMinutes, formatTime } from './dates.js';
import { filled, dayStats } from './store.js';
import { makeList, makeListItem } from './templates.js';
import { ensurePlanSettings } from './plan.js';
import { esc } from './util.js';
import { icon } from './ui.js';

export const WEEKEND_RESET = [
  { text: 'Grocery peek — what’s running low?', color: 'sage' },
  { text: 'Start one load of laundry', color: 'sky' },
  { text: 'Sketch meals for a few days', color: 'butter' },
  { text: 'Session / listing prep (if any)', color: 'lavender' },
  { text: 'Something small just for you', color: 'blush' },
];

/** ISO-ish week key ending on Sunday (America/Chicago local dates). */
export function weekKeyFor(dateKey) {
  const d = fromKey(dateKey);
  const day = d.getDay(); // 0 Sun
  const sunday = addDays(dateKey, day === 0 ? 0 : 7 - day);
  return sunday; // use Sunday date as week id
}

export function nextMonday(dateKey) {
  const d = fromKey(dateKey);
  const day = d.getDay();
  const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  return addDays(dateKey, day === 1 ? 0 : add);
}

export function retentionOf(store) {
  ensurePlanSettings(store.settings);
  return store.settings.retention;
}

export function saveRetention(store, patch, opts) {
  ensurePlanSettings(store.settings);
  Object.assign(store.settings.retention, patch);
  store.settings.updatedAt = new Date().toISOString();
  store.commit('settings', opts);
}

/** Top 3 focus candidates: incomplete timed first, then important untimed. */
export function focusCandidates(day, limit = 3) {
  const timed = [];
  const untimed = [];
  for (const s of day.sections || []) {
    for (const it of filled(s.items || [])) {
      if (it.done) continue;
      const row = { s, it };
      if (it.time) timed.push(row);
      else if (s.role === 'issues' || s.role === 'todo' || s.role === 'sessions') untimed.push(row);
    }
  }
  timed.sort((a, b) => (a.it.time || '').localeCompare(b.it.time || ''));
  return [...timed, ...untimed].slice(0, limit);
}

/** Update streak after a day may have gained a completion. Soft reset if gap. */
export function touchStreak(store, dateKey = todayKey()) {
  const { done } = dayStats(store.getDay(dateKey));
  if (done < 1) return;
  const r = retentionOf(store);
  const today = dateKey;
  if (r.streakLastDay === today) return; // already counted
  const yesterday = addDays(today, -1);
  let count = 1;
  if (r.streakLastDay === yesterday) count = (r.streakCount || 0) + 1;
  else if (r.streakLastDay && r.streakLastDay !== today) count = 1; // soft fresh start
  saveRetention(store, { streakCount: count, streakLastDay: today });
}

export function streakChipHTML(store, dateKey = todayKey()) {
  const r = retentionOf(store);
  let count = r.streakCount || 0;
  const today = todayKey();
  // If last activity wasn't yesterday/today, show soft reset message potential
  if (r.streakLastDay && r.streakLastDay !== today && r.streakLastDay !== addDays(today, -1)) {
    count = 0;
  }
  if (count >= 2) {
    return `<span class="streak-chip" title="Days in a row with something checked off">${count}-day rhythm</span>`;
  }
  if (count === 1 && r.streakLastDay === today) {
    return `<span class="streak-chip soft" title="Nice — you checked something off">Day one · keep it light</span>`;
  }
  if (r.streakLastDay && r.streakLastDay !== today && r.streakLastDay !== addDays(today, -1)) {
    return `<span class="streak-chip soft">Start fresh today</span>`;
  }
  return '';
}

export function applyWeekendReset(store, dateKey) {
  const title = 'Weekend reset';
  const day = store.getDay(dateKey);
  const existing = (day.lists || []).find((L) => L.title === title);
  store.mutateDay(dateKey, (d) => {
    d.lists = d.lists || [];
    let L = d.lists.find((x) => x.title === title);
    if (!L) {
      L = makeList({
        title,
        color: 'teal',
        items: WEEKEND_RESET.map((x) => x.text),
      });
      d.lists.push(L);
    } else {
      // append missing starter lines only
      const have = new Set(L.items.map((i) => (i.text || '').trim().toLowerCase()));
      for (const row of WEEKEND_RESET) {
        if (!have.has(row.text.toLowerCase())) L.items.push(makeListItem({ text: row.text }));
      }
    }
  });
  return !!existing;
}

export function seasonalTease() {
  // Oct 2026 → fall
  const m = new Date().getMonth() + 1;
  if (m >= 9 && m <= 11) {
    return {
      id: 'fall-2026',
      title: 'Fall sticker teasers',
      body: 'Witchy + Plant mama packs are free teasers this season — soft moons, leaves, and calm magic.',
      packs: ['witchy', 'plant'],
      proNote: 'Full lifestyle packs unlock with Pro later.',
    };
  }
  if (m === 12 || m <= 2) {
    return { id: 'winter', title: 'Cozy season stickers', body: 'Try Sweet + Mom life teasers for quiet winter days.', packs: ['sweet', 'mom'], proNote: 'Full packs unlock with Pro later.' };
  }
  return null;
}

export function showSundayPrompt(store, dateKey = todayKey()) {
  const d = fromKey(dateKey);
  // Sunday, or Saturday evening after 5pm
  const isSun = d.getDay() === 0;
  const isSatEve = d.getDay() === 6 && nowMinutes() >= 17 * 60;
  if (!isSun && !isSatEve) return false;
  if (dateKey !== todayKey()) return false;
  const wk = weekKeyFor(dateKey);
  const r = retentionOf(store);
  return r.sundayPromptDismissedWeek !== wk;
}

export function showEodNudge(store, dateKey = todayKey()) {
  if (dateKey !== todayKey()) return false;
  if (nowMinutes() < 19 * 60) return false;
  const r = retentionOf(store);
  return r.eodNudgeDismissedDay !== dateKey;
}

export function focusStripHTML(day, { empty = true } = {}) {
  const focus = focusCandidates(day, 3);
  if (!focus.length) {
    if (!empty) return '';
    return `<div class="focus-strip empty">
      <div class="focus-head"><span class="focus-label">Top 3</span><span class="focus-hint">Pick up to 3 things to conquer today</span></div>
      <form class="focus-quick" autocomplete="off" data-act-form="focus-add">
        <input name="q" data-fid="focus-add" placeholder="One thing…" aria-label="Add a focus item" enterkeyhint="done">
        <button class="btn small primary" type="submit">${icon.plus} Add</button>
      </form>
    </div>`;
  }
  const rows = focus.map(({ s, it }) => `<li class="focus-row c-${s.color}" data-item="${it.id}">
    <button class="check" data-act="focus-toggle" role="checkbox" aria-checked="false" aria-label="Done">${icon.check}</button>
    <span class="focus-text">${it.time ? `<time>${esc(formatTime(it.time, true))}</time> ` : ''}${it.label ? `<b>${esc(it.label)}:</b> ` : ''}${esc(it.text)}</span>
  </li>`).join('');
  return `<div class="focus-strip">
    <div class="focus-head"><span class="focus-label">Top 3</span><span class="focus-hint">Today’s gentle focus</span></div>
    <ul class="focus-list">${rows}</ul>
  </div>`;
}

export function sundayCardHTML(dateKey, { pro = true } = {}) {
  const mon = nextMonday(dateKey);
  const primary = pro
    ? `<a class="btn small primary" href="#/day/${mon}">Open Monday</a>`
    : `<button class="btn small primary" data-act="sunday-plan" data-href="#/day/${mon}">Plan with Pro</button>`;
  return `<div class="habit-card sunday-card" data-card="sunday">
    <div><b>Plan next week in 2 minutes</b><p>${pro ? 'Skim Monday and set one anchor — that’s enough.' : 'A gentle Sunday template — unlocks with Pro. Free keeps Top 3 + streaks.'}</p></div>
    <div class="habit-actions">
      ${primary}
      <button class="btn small ghost" data-act="dismiss-sunday">Not now</button>
    </div>
  </div>`;
}

export function eodNudgeHTML(dateKey) {
  return `<div class="habit-card eod-nudge" data-card="eod">
    <div><b>Wrap your day?</b><p>A calm End of Day overview — optional, no scorekeeping.</p></div>
    <div class="habit-actions">
      <a class="btn small primary" href="#/eod/${dateKey}">End of day</a>
      <button class="btn small ghost" data-act="dismiss-eod">Dismiss</button>
    </div>
  </div>`;
}

export function seasonalBannerHTML(tease) {
  if (!tease) return '';
  return `<div class="habit-card seasonal-card" data-card="seasonal">
    <div><b>${esc(tease.title)}</b><p>${esc(tease.body)} <span class="muted">${esc(tease.proNote)}</span></p></div>
    <div class="habit-actions">
      <a class="btn small" href="#/style/stickers">See stickers</a>
      <button class="btn small ghost" data-act="dismiss-seasonal">Got it</button>
    </div>
  </div>`;
}

export function weekendResetBtnHTML(dateKey) {
  if (!isWeekend(dateKey)) return '';
  return `<button class="btn small" data-act="weekend-reset" title="Light weekend checklist">${icon.spark}<span>Weekend reset</span></button>`;
}

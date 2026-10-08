import { todayKey, addDays, timeToMinutes, formatTime } from './dates.js';
import { filled } from './store.js';
import { icon, openPopover, closePopover } from './ui.js';
import { esc } from './util.js';

/** Reminder offsets (minutes before the item time). 0 = at the time. */
export const ALARM_OFFSETS = [
  { minutes: 0, label: 'At time' },
  { minutes: 5, label: '5 min before' },
  { minutes: 10, label: '10 min before' },
  { minutes: 15, label: '15 min before' },
  { minutes: 30, label: '30 min before' },
  { minutes: 60, label: '1 hour before' },
];

export function normalizeAlarm(alarm) {
  if (!alarm || typeof alarm !== 'object') return { enabled: false, offsetMinutes: 10 };
  const offset = Number(alarm.offsetMinutes);
  const allowed = ALARM_OFFSETS.map((o) => o.minutes);
  return {
    enabled: !!alarm.enabled,
    offsetMinutes: allowed.includes(offset) ? offset : 10,
  };
}

export function hasAlarm(it) {
  return !!(it?.alarm?.enabled && it?.time);
}

export function alarmOffsetLabel(minutes) {
  return ALARM_OFFSETS.find((o) => o.minutes === minutes)?.label || `${minutes} min before`;
}

/** Fire-at Date in local America/Chicago box time (browser local). */
export function alarmFireAt(dateKey, hhmm, offsetMinutes = 0) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const mins = timeToMinutes(hhmm);
  if (mins == null) return null;
  const dt = new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60, 0, 0);
  dt.setMinutes(dt.getMinutes() - (Number(offsetMinutes) || 0));
  return dt;
}

const FIRED_KEY = 'momos:alarms-fired';
function loadFired() {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}') || {}; }
  catch { return {}; }
}
function saveFired(map) {
  // prune entries older than 3 days
  const cutoff = Date.now() - 3 * 864e5;
  for (const [k, v] of Object.entries(map)) if (typeof v === 'number' && v < cutoff) delete map[k];
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(map)); } catch {}
}

export function firedKey(dateKey, itemId, fireMs) {
  return `${dateKey}:${itemId}:${fireMs}`;
}

export async function ensureNotifyPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const r = await Notification.requestPermission();
    return r;
  } catch { return 'denied'; }
}

function itemTitle(it) {
  const t = (it.text || '').trim();
  return it.label ? `${it.label}: ${t}` : t;
}

/**
 * Scan today (+ tiny tomorrow window) for due alarms; notify once per item.
 * Call on boot, every minute, and on visibility/focus.
 */
export function tickAlarms(store, { toast } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const fired = loadFired();
  const now = Date.now();
  const keys = [addDays(todayKey(), -1), todayKey(), addDays(todayKey(), 1)];
  for (const dateKey of keys) {
    if (!store.hasDay(dateKey) && dateKey !== todayKey()) continue;
    const day = store.getDay(dateKey);
    for (const sec of day.sections || []) {
      for (const it of filled(sec.items || [])) {
        if (!hasAlarm(it) || it.done) continue;
        const alarm = normalizeAlarm(it.alarm);
        const fire = alarmFireAt(dateKey, it.time, alarm.offsetMinutes);
        if (!fire) continue;
        const fireMs = fire.getTime();
        // Due window: from fire time until 2 minutes after (avoid spam / miss)
        if (now < fireMs || now > fireMs + 120000) continue;
        const fk = firedKey(dateKey, it.id, fireMs);
        if (fired[fk]) continue;
        fired[fk] = now;
        const title = itemTitle(it) || 'Reminder';
        const body = alarm.offsetMinutes === 0
          ? `It's ${formatTime(it.time, true)} · ${sec.title}`
          : `${alarmOffsetLabel(alarm.offsetMinutes)} · ${formatTime(it.time, true)} · ${sec.title}`;
        try {
          const n = new Notification(`Mom.OS · ${title}`, {
            body,
            tag: `momos-${it.id}`,
            renotify: false,
            silent: false,
          });
          n.onclick = () => { try { window.focus(); location.hash = `#/myday/${dateKey}`; n.close(); } catch {} };
        } catch (e) {
          console.warn('notify', e);
          toast?.(title);
        }
      }
    }
  }
  saveFired(fired);
}

export function startAlarmClock(store, opts = {}) {
  const run = () => { try { tickAlarms(store, opts); } catch (e) { console.warn('alarms', e); } };
  run();
  const id = setInterval(run, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  window.addEventListener('focus', run);
  return () => clearInterval(id);
}

const TIME_CHIPS = [['07:00', '7a'], ['09:00', '9a'], ['12:00', 'Noon'], ['15:00', '3p'], ['17:30', '5:30p'], ['19:30', '7:30p'], ['20:30', '8:30p']];

/**
 * Bell picker: enable/disable + offset, or prompt for a time first.
 * onChange(alarm|{enabled,offsetMinutes}|null, time?) — time set when adding time from this sheet.
 */
export function openAlarmEditor(anchor, { item, onSave, onNeedPermission }) {
  const hasTime = !!(item.time);
  const cur = normalizeAlarm(item.alarm);

  if (!hasTime) {
    const el = openPopover(anchor, `
      <h3 class="pop-title">${icon.bell} Reminder</h3>
      <p class="pop-msg">Add a time to set a reminder for this line.</p>
      <input type="time" class="time-input" value="" step="300" aria-label="Time">
      <div class="chips">${TIME_CHIPS.map(([v, l]) => `<button class="chip" data-t="${v}">${l}</button>`).join('')}</div>
      <div class="pop-row"><button class="btn ghost" data-a="cancel">Cancel</button><button class="btn primary" data-a="set">Set time &amp; remind</button></div>`,
    { width: 300 });
    const inp = el.querySelector('.time-input');
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-t]');
      if (t) inp.value = t.dataset.t;
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') { closePopover(); return; }
      if (a === 'set') {
        const time = inp.value;
        if (!time) { inp.focus(); return; }
        closePopover();
        if (onNeedPermission) await onNeedPermission();
        onSave({ enabled: true, offsetMinutes: 10 }, time);
      }
    });
    return el;
  }

  const offsets = ALARM_OFFSETS.map((o) =>
    `<button class="chip ${cur.enabled && cur.offsetMinutes === o.minutes ? 'on' : ''}" data-off="${o.minutes}">${esc(o.label)}</button>`
  ).join('');
  const el = openPopover(anchor, `
    <h3 class="pop-title">${icon.bell} Reminder</h3>
    <p class="pop-help muted">For ${formatTime(item.time, true)}. In-app alerts work while Mom.OS is open; lock-screen alarms need your calendar subscription.</p>
    <label class="chk alarm-enable"><input type="checkbox" id="al-on" ${cur.enabled ? 'checked' : ''}> Remind me</label>
    <div class="chips alarm-offsets ${cur.enabled ? '' : 'is-disabled'}">${offsets}</div>
    <div class="pop-row"><button class="btn ghost" data-a="off">Turn off</button><button class="btn primary" data-a="done">Done</button></div>`,
  { width: 300 });

  const box = el.querySelector('#al-on');
  const chips = el.querySelector('.alarm-offsets');
  let enabled = cur.enabled;
  let offset = cur.offsetMinutes;

  const sync = () => {
    chips.classList.toggle('is-disabled', !enabled);
    chips.querySelectorAll('[data-off]').forEach((c) => c.classList.toggle('on', enabled && Number(c.dataset.off) === offset));
    box.checked = enabled;
  };

  box.addEventListener('change', async () => {
    enabled = box.checked;
    if (enabled && onNeedPermission) await onNeedPermission();
    sync();
  });
  el.addEventListener('click', async (e) => {
    const off = e.target.closest('[data-off]');
    if (off) {
      offset = Number(off.dataset.off);
      enabled = true;
      if (onNeedPermission) await onNeedPermission();
      sync();
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'off') {
      enabled = false;
      onSave({ enabled: false, offsetMinutes: offset });
      closePopover();
      return;
    }
    if (a === 'done') {
      onSave({ enabled, offsetMinutes: offset });
      closePopover();
    }
  });
  return el;
}

import { eachDay, timeToMinutes, minutesToTime, addDays } from '../dates.js';
import { filled } from '../store.js';
import { hasAlarm, normalizeAlarm } from '../alarms.js';

/**
 * Normalised, provider-agnostic event model. Every sync target (file export,
 * subscription feed, CalDAV) consumes this same shape, so adding a target
 * never touches planner views.
 *
 * { uid, date:'YYYY-MM-DD', start:'HH:MM', endDate, end:'HH:MM', title,
 *   description, category, color, done, sourceItemId, sourceSectionId,
 *   alarmMinutes: number|null }  // null = no per-item alarm; 0 = at time
 */
export function collectEvents(store, startKey, endKey, { includeDone = true } = {}) {
  const out = [];
  for (const key of eachDay(startKey, endKey)) {
    if (!store.hasDay(key)) continue; // un-edited template days have nothing timed
    const day = store.getDay(key);
    for (const sec of day.sections) {
      for (const it of filled(sec.items)) {
        if (!it.time) continue;
        if (!includeDone && it.done) continue;
        const startMin = timeToMinutes(it.time);
        const endAbs = startMin + (Number(sec.duration) || 30);
        const endDate = endAbs >= 1440 ? addDays(key, 1) : key;
        const title = it.label ? `${it.label}: ${it.text.trim()}` : it.text.trim();
        const alarm = hasAlarm(it) ? normalizeAlarm(it.alarm).offsetMinutes : null;
        out.push({
          uid: `${it.id}@momos`,
          date: key, start: it.time,
          endDate, end: minutesToTime(endAbs % 1440),
          title, category: sec.title,
          description: `${sec.title}${it.done ? ' (done)' : ''} · · Mom.OS`,
          color: sec.color, done: !!it.done,
          sourceItemId: it.id, sourceSectionId: sec.id,
          alarmMinutes: alarm,
        });
      }
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

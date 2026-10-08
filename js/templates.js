import { uid, clone } from './util.js';
import { isWeekend } from './dates.js';

/** Colors are palette keys; each theme defines its own shade for every key. */
export const PALETTE = ['teal', 'blush', 'rose', 'sage', 'lavender', 'butter', 'peach', 'sky', 'stone'];

/**
 * A template is a list of section blueprints. `slots` are pre-labelled lines
 * (e.g. meal names) that start empty on every new day.
 * role: issues | meals | todo | sessions | custom  (used for quick-add + defaults)
 * duration: default event length (minutes) when exported to a calendar.
 */
export const DEFAULT_TEMPLATES = {
  weekday: [
    { title: "Today's Issues", subtitle: "What we're conquering today", color: 'blush', role: 'issues', duration: 30, slots: [] },
    { title: 'What Are We Eating', subtitle: 'Dinner', color: 'sage', role: 'meals', duration: 45, slots: ['Dinner'] },
    { title: 'Important Things To Do', subtitle: 'Give each one a time', color: 'teal', role: 'todo', duration: 30, slots: [] },
  ],
  weekend: [
    { title: "Today's Issues", subtitle: "What we're conquering today", color: 'blush', role: 'issues', duration: 30, slots: [] },
    { title: 'What Are We Eating', subtitle: 'Breakfast · Lunch · Dinner · Snack', color: 'sage', role: 'meals', duration: 45, slots: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
    { title: 'Important Things To Do', subtitle: 'Give each one a time', color: 'teal', role: 'todo', duration: 30, slots: [] },
    { title: 'Sessions', subtitle: 'Photo sessions', color: 'lavender', role: 'sessions', duration: 90, slots: [] },
  ],
};

export function templateKind(dateKey) { return isWeekend(dateKey) ? 'weekend' : 'weekday'; }

export function makeItem(partial = {}) {
  return { id: uid('it'), text: '', time: null, done: false, ...partial };
}

export function sectionFromBlueprint(bp) {
  return {
    id: uid('sec'),
    title: bp.title, subtitle: bp.subtitle || '', color: bp.color || 'teal',
    role: bp.role || 'custom', duration: bp.duration || 30,
    items: (bp.slots || []).map((label) => makeItem({ label })),
  };
}

export function instantiate(templates, dateKey) {
  const kind = templateKind(dateKey);
  const tpl = templates?.[kind] || DEFAULT_TEMPLATES[kind];
  return { key: dateKey, template: kind, sections: tpl.map(sectionFromBlueprint), notes: '', createdAt: Date.now() };
}

/** Turn a day's current layout back into a blueprint (labels kept, content dropped). */
export function blueprintFromDay(day) {
  return day.sections.map((s) => ({
    title: s.title, subtitle: s.subtitle, color: s.color, role: s.role, duration: s.duration,
    slots: s.items.filter((i) => i.label).map((i) => i.label),
  }));
}

export const defaultTemplates = () => clone(DEFAULT_TEMPLATES);

/** Built-in starter list ideas (not persisted until user creates one). */
export const LIST_STARTERS = [
  { title: 'Packing list', color: 'sky', items: ['Charger', 'Water bottle', 'Snacks'] },
  { title: 'Grocery list', color: 'sage', items: ['Milk', 'Eggs', 'Bread'] },
  { title: 'Session shot list', color: 'lavender', items: ['Wide establishing', 'Detail shots', 'Candids'] },
  { title: 'Kid stuff to pack', color: 'butter', items: ['Spare clothes', 'Snacks', 'Favorite toy'] },
  { title: 'To-buy', color: 'peach', items: [] },
];

export function makeListItem(partial = {}) {
  return { id: uid('li'), text: '', done: false, ...partial };
}

export function makeList(partial = {}) {
  return {
    id: uid('list'),
    title: partial.title || 'New list',
    color: partial.color || 'teal',
    items: (partial.items || []).map((t) => (typeof t === 'string' ? makeListItem({ text: t }) : makeListItem(t))),
    createdAt: Date.now(),
  };
}

export function ensureDayExtras(day) {
  if (!day) return day;
  if (!Array.isArray(day.lists)) day.lists = [];
  if (!day.reflection || typeof day.reflection !== 'object') {
    day.reflection = { wentWell: '', carryOver: '', focus: '' };
  } else {
    day.reflection.wentWell ??= '';
    day.reflection.carryOver ??= '';
    day.reflection.focus ??= '';
  }
  return day;
}

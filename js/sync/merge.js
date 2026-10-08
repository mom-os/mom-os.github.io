/** Last-write-wins helpers. Timestamps are ISO-8601 strings. */

export function newer(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return String(a).localeCompare(String(b));
}

/** Merge two day maps: { 'YYYY-MM-DD': dayDoc }. Prefer newer updatedAt. */
export function mergeDayMaps(local = {}, remote = {}) {
  const out = { ...local };
  const conflicts = [];
  for (const [key, rDoc] of Object.entries(remote || {})) {
    const lDoc = out[key];
    if (!lDoc) { out[key] = rDoc; continue; }
    const cmp = newer(lDoc.updatedAt, rDoc.updatedAt);
    if (cmp < 0) out[key] = rDoc;
    else if (cmp === 0 && JSON.stringify(lDoc) !== JSON.stringify(rDoc)) {
      conflicts.push({ type: 'day', key });
    }
  }
  return { days: out, conflicts };
}

export function mergeDoc(local, remote) {
  if (!remote) return { doc: local, winner: 'local' };
  if (!local) return { doc: remote, winner: 'remote' };
  const cmp = newer(local.updatedAt, remote.updatedAt);
  if (cmp < 0) return { doc: remote, winner: 'remote' };
  return { doc: local, winner: 'local' };
}

export function mergeMonthNotes(local = {}, remote = {}) {
  const out = { ...local };
  for (const [key, rList] of Object.entries(remote || {})) {
    const lWrap = out[key];
    const lItems = Array.isArray(lWrap) ? lWrap : lWrap?.items;
    const rItems = Array.isArray(rList) ? rList : rList?.items;
    const lAt = Array.isArray(lWrap) ? null : lWrap?.updatedAt;
    const rAt = Array.isArray(rList) ? null : rList?.updatedAt;
    if (!lItems) {
      out[key] = Array.isArray(rList) ? { items: rList, updatedAt: rAt || new Date().toISOString() } : rList;
      continue;
    }
    const cmp = newer(lAt, rAt);
    if (cmp < 0) out[key] = Array.isArray(rList) ? { items: rItems, updatedAt: rAt } : rList;
  }
  for (const [key, v] of Object.entries(out)) {
    if (Array.isArray(v)) out[key] = { items: v, updatedAt: new Date(0).toISOString() };
  }
  return out;
}

export function snapshotForSync(state) {
  const settingsDoc = {
    textSize: state.settings.textSize,
    style: state.settings.style,
    showAnchors: state.settings.showAnchors,
    anchors: state.settings.anchors,
    updatedAt: state.settings.updatedAt || null,
  };
  const templatesDoc = { weekday: state.templates.weekday, weekend: state.templates.weekend, updatedAt: state.templates.updatedAt || null };
  const stamps = state.meta?.monthNotesUpdatedAt || {};
  const monthNotes = {};
  for (const [k, v] of Object.entries(state.monthNotes || {})) {
    monthNotes[k] = { items: Array.isArray(v) ? v : (v.items || []), updatedAt: stamps[k] || null };
  }
  return { days: { ...state.days }, settings: settingsDoc, templates: templatesDoc, monthNotes, meta: state.meta };
}

/**
 * Privacy-friendly product analytics → Supabase analytics_events.
 * No PII, no IP. Respects Do Not Track. Random per-browser visitor id.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';

const VID_KEY = 'momos:vid';
const UTM_KEY = 'momos:utm_source';
const VISIT_KEY = 'momos:visit-count';
const VISIT_DAY_KEY = 'momos:visit-day';

const ALLOWED = new Set([
  'page_view', 'start_free_click', 'signin_code_sent', 'signup_complete',
  'pro_sheet_open', 'checkout_start', 'install_click',
]);

function dntEnabled() {
  try {
    const d = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return d === '1' || d === 'yes';
  } catch { return false; }
}

function uuid() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id || id.length < 30) {
      id = uuid();
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

/** Capture ?utm_source=… once per session/browser for later events. */
export function captureUtmFromLocation() {
  try {
    const u = new URL(location.href);
    const src = (u.searchParams.get('utm_source') || '').trim().slice(0, 80);
    if (src) localStorage.setItem(UTM_KEY, src);
  } catch {}
}

export function storedUtmSource() {
  try { return (localStorage.getItem(UTM_KEY) || '').slice(0, 80); } catch { return ''; }
}

function referrerHost() {
  try {
    if (!document.referrer) return '';
    const h = new URL(document.referrer).hostname || '';
    if (!h || h === location.hostname) return '';
    return h.slice(0, 200);
  } catch { return ''; }
}

export function bumpVisitCount() {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // YYYY-MM-DD
    const lastDay = localStorage.getItem(VISIT_DAY_KEY);
    let n = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) || 0;
    if (lastDay !== today) {
      n += 1;
      localStorage.setItem(VISIT_KEY, String(n));
      localStorage.setItem(VISIT_DAY_KEY, today);
    }
    return n;
  } catch { return 1; }
}

export function getVisitCount() {
  try { return parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) || 0; } catch { return 0; }
}

let _pageViewSent = false;

export async function track(name, props = {}) {
  if (!ALLOWED.has(name)) return;
  if (dntEnabled()) return;
  if (!isSupabaseConfigured()) return;
  try {
    const path = (props.path != null ? String(props.path) : (location.hash || '#/')).slice(0, 200);
    const body = {
      name,
      path,
      referrer_host: (props.referrer_host != null ? String(props.referrer_host) : referrerHost()).slice(0, 200) || null,
      utm_source: (props.utm_source != null ? String(props.utm_source) : storedUtmSource()).slice(0, 80) || null,
      visitor_id: getVisitorId(),
      props: typeof props === 'object' && props ? {
        // strip reserved keys from props bag
        ...Object.fromEntries(Object.entries(props).filter(([k]) => !['path', 'referrer_host', 'utm_source'].includes(k))),
      } : {},
    };
    // fire-and-forget
    fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export function trackPageViewOnce() {
  if (_pageViewSent) return;
  _pageViewSent = true;
  captureUtmFromLocation();
  bumpVisitCount();
  track('page_view', { path: location.hash || '#/' });
}

export function trackHashPageView() {
  if (dntEnabled()) return;
  track('page_view', { path: location.hash || '#/' });
}

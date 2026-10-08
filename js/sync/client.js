import { createClient } from '../vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL, isSupabaseConfigured } from '../config.js';

let _client = null;

/**
 * Implicit flow is required for email magic-link redirects from Mail/admin
 * generateLink: those land as #access_token=... (no PKCE code_verifier in the browser).
 * PKCE mode rejects that URL with "Not a valid PKCE flow url" and drops the session.
 */
export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    });
  }
  return _client;
}

export function redirectTo() {
  try {
    const o = location.origin;
    if (/localhost|127\.0\.0\.1/.test(o)) return o + (location.pathname.replace(/\/[^/]*$/, '/') || '/');
  } catch {}
  return SITE_URL.replace(/\/?$/, '/');
}

/** True if the current URL looks like a Supabase auth callback. */
export function urlHasAuthCallback() {
  try {
    const hash = (location.hash || '').replace(/^#/, '');
    const hp = new URLSearchParams(hash);
    if (hp.has('access_token') || hp.has('error_description') || hp.has('refresh_token')) return true;
    const sp = new URLSearchParams(location.search);
    if (sp.has('code') || sp.has('error_description')) return true;
  } catch {}
  return false;
}

/**
 * Wait for supabase-js to finish reading tokens from the URL (if any).
 * Returns { session, fromUrl, errorMessage }.
 */
export async function recoverAuthFromUrl() {
  const sb = getSupabase();
  if (!sb) return { session: null, fromUrl: false, errorMessage: null };
  const fromUrl = urlHasAuthCallback();
  const { data, error } = await sb.auth.getSession();
  if (error) return { session: null, fromUrl, errorMessage: error.message };
  // After implicit success, gotrue clears hash to ""; put a real app route back.
  if (fromUrl && data.session) {
    const clean = location.pathname + location.search + '#/myday';
    if (location.hash !== '#/myday') {
      history.replaceState(null, '', clean);
    }
  } else if (fromUrl && !data.session) {
    // Failed callback — strip broken auth hash so the router can work
    history.replaceState(null, '', location.pathname + location.search + '#/style/account');
  }
  return { session: data.session || null, fromUrl, errorMessage: null };
}

/** Send a 6-digit email code (and a desktop-friendly link in the same email). */
export async function sendSignInCode(email) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync is not configured yet');
  const { error } = await sb.auth.signInWithOtp({
    email: String(email || '').trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo(),
    },
  });
  if (error) throw error;
}

/**
 * Verify the 6-digit code. Admin generateLink(type:'magiclink') OTPs verify as
 * type magiclink (and also as email). Prefer magiclink first so a wrong-type
 * attempt never surfaces a misleading "expired" before the right type runs.
 */
export async function verifySignInCode(email, token) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync is not configured yet');
  const code = String(token || '').replace(/\s+/g, '');
  const addr = String(email || '').trim();
  let data, error;
  ({ data, error } = await sb.auth.verifyOtp({ email: addr, token: code, type: 'magiclink' }));
  if (error) {
    ({ data, error } = await sb.auth.verifyOtp({ email: addr, token: code, type: 'email' }));
  }
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('expired') || msg.includes('invalid') || error.code === 'otp_expired') {
      const e = new Error(
        'That code is no longer valid. If you already tapped the link in the email, try refreshing — you may already be signed in. Otherwise ask for a new code.',
      );
      e.code = error.code;
      throw e;
    }
    throw error;
  }
  return data;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(cb) {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data.subscription.unsubscribe();
}

async function pairFetch(body, authed = false) {
  if (!isSupabaseConfigured()) throw new Error('Cloud sync is not configured yet');
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
  if (authed) {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) throw new Error('Sign in on this device first');
    headers.Authorization = `Bearer ${jwt}`;
  } else {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/pair`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Pairing failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Create a short-lived device pairing code (requires signed-in session). */
export async function createPairingCode() {
  return pairFetch({ action: 'create' }, true);
}

/** Redeem a pairing code on this device and establish a session. */
export async function redeemPairingCode(code) {
  const cleaned = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const data = await pairFetch({ action: 'redeem', code: cleaned }, false);
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync is not configured yet');
  if (!data.access_token || !data.refresh_token) throw new Error('No session returned');
  const { data: sess, error } = await sb.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw error;
  return sess;
}

/** @deprecated use sendSignInCode */
export const signInWithEmail = sendSignInCode;

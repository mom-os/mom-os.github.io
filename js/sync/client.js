import { createClient } from '../vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL, isSupabaseConfigured } from '../config.js';

let _client = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
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

/** Verify the 6-digit code from the email inside this app (works for home-screen PWAs). */
export async function verifySignInCode(email, token) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync is not configured yet');
  const code = String(token || '').replace(/\s+/g, '');
  const { data, error } = await sb.auth.verifyOtp({
    email: String(email || '').trim(),
    token: code,
    type: 'email',
  });
  if (error) throw error;
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

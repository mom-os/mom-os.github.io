#!/usr/bin/env node
/** Live pairing test. Never prints codes/tokens. Requires planner-secrets/supabase.env */
import { createClient } from '../js/vendor/supabase.js';
import { readFileSync } from 'fs';
import { webcrypto } from 'crypto';

const env = Object.fromEntries(
  readFileSync('/workspace/planner-secrets/supabase.env', 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
      const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const url = env.SUPABASE_URL, service = env.SUPABASE_SERVICE_ROLE_KEY, anon = env.SUPABASE_ANON_KEY;
const FN = `${url}/functions/v1/pair`;
const results = [];
const ok = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}${detail ? ' — ' + String(detail).slice(0, 100) : ''}`);
};

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `momos-pair-${Date.now()}@hotmail.com`;
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email, email_confirm: true, password: 'TempPairTest!9x_' + Date.now(),
});
ok('create test user', !cErr && !!created?.user, cErr?.message);
const userId = created?.user?.id;
const clientA = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
ok('generateLink for A', !linkErr, linkErr?.message);
const { data: sessA, error: verAErr } = await clientA.auth.verifyOtp({
  email, token: linkData?.properties?.email_otp, type: 'email',
});
ok('device A signed in', !verAErr && !!sessA?.session, verAErr?.message);
const jwt = sessA?.session?.access_token;

async function callPair(body, token) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${token || anon}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const createRes = await callPair({ action: 'create' }, jwt);
ok('create pairing code', createRes.status === 200 && !!createRes.json.code, createRes.json.error);
const code = createRes.json.code || '';
ok('code shape', /^[A-Z2-9]{8}$/.test(code), `len=${code.length}`);

const clientB = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
ok('wrong rejected', (await callPair({ action: 'redeem', code: 'ZZZZZZZZ' }, anon)).status >= 400);
const redeem = await callPair({ action: 'redeem', code }, anon);
ok('redeem ok', redeem.status === 200 && !!redeem.json.access_token, redeem.json.error);
if (redeem.json.access_token) {
  const { data: setB, error: setErr } = await clientB.auth.setSession({
    access_token: redeem.json.access_token, refresh_token: redeem.json.refresh_token,
  });
  ok('B session', !setErr && setB?.session?.user?.id === userId, setErr?.message);
}
const dayKey = '2026-10-08';
const doc = { sections: [{ id: 's1', title: 'PAIR', items: [{ id: 'i1', text: 'sync-ok', done: false }] }], updatedAt: new Date().toISOString() };
ok('A write', !(await clientA.from('days').upsert({ user_id: userId, day_date: dayKey, doc })).error);
const { data: pulled } = await clientB.from('days').select('doc').eq('user_id', userId).eq('day_date', dayKey).maybeSingle();
ok('B sync read', pulled?.doc?.sections?.[0]?.items?.[0]?.text === 'sync-ok');
ok('replay rejected', (await callPair({ action: 'redeem', code }, anon)).status >= 400);

async function sha256Hex(s) {
  const buf = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const expiredPlain = 'ABCDEFGH';
await admin.from('pairing_codes').insert({
  user_id: userId, code_hash: await sha256Hex(expiredPlain),
  expires_at: new Date(Date.now() - 60_000).toISOString(),
});
ok('expired rejected', /expir/i.test((await callPair({ action: 'redeem', code: expiredPlain }, anon)).json.error || ''));
ok('create needs JWT', (await callPair({ action: 'create' }, anon)).status === 401);

await admin.from('days').delete().eq('user_id', userId);
await admin.from('pairing_codes').delete().eq('user_id', userId);
ok('delete user', !(await admin.auth.admin.deleteUser(userId)).error);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED ${failed.length}/${results.length}` : `ALL ${results.length} CHECKS PASSED`);
process.exit(failed.length ? 1 : 0);

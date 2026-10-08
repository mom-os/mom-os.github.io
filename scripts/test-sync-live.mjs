/**
 * Live sync / ICS smoke test. Requires /workspace/planner-secrets/supabase.env
 * Creates momos-test@example.com via admin API, simulates two devices, deletes user after.
 */
import { createClient } from '../js/vendor/supabase.js';
import { readFileSync, existsSync } from 'fs';
import { mergeDayMaps } from '../js/sync/merge.js';
import { buildICS } from '../js/calendar/ics.js';

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const secretsPath = '/workspace/planner-secrets/supabase.env';
if (!existsSync(secretsPath)) {
  console.log('SKIP: secrets file missing (provision first)');
  process.exit(0);
}
const env = loadEnv(secretsPath);
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = 'momos-test@example.com';

let userId;
try {
  // delete if exists
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of listed.data?.users || []) {
    if (u.email === email) await admin.auth.admin.deleteUser(u.id);
  }
  const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;

  // magic link
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr) throw linkErr;
  const props = linkData.properties || {};
  // sign in as user with hashed token via verifyOtp if available
  const anonA = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const anonB = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const tokenHash = props.hashed_token;
  if (tokenHash) {
    const v = await anonA.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
    if (v.error) throw v.error;
  } else {
    // fallback: use service role to insert session is hard — use password temp
    await admin.auth.admin.updateUserById(userId, { password: 'Test-MomOS-Sync-9x!' });
    const s = await anonA.auth.signInWithPassword({ email, password: 'Test-MomOS-Sync-9x!' });
    if (s.error) throw s.error;
  }
  // second device
  await admin.auth.admin.updateUserById(userId, { password: 'Test-MomOS-Sync-9x!' });
  const s2 = await anonB.auth.signInWithPassword({ email, password: 'Test-MomOS-Sync-9x!' });
  if (s2.error) throw s2.error;

  const day = '2026-10-08';
  const docA = {
    sections: [{ id: 's1', title: 'Todo', duration: 30, items: [{ id: 'item_live_1', text: 'From device A', time: '09:15', done: false }] }],
    updatedAt: new Date().toISOString(),
  };
  const { error: upErr } = await anonA.from('days').upsert({ user_id: userId, day_date: day, doc: docA, updated_at: docA.updatedAt });
  if (upErr) throw upErr;

  // device B pulls
  await new Promise((r) => setTimeout(r, 500));
  const { data: pulled, error: pErr } = await anonB.from('days').select('doc, updated_at').eq('day_date', day).single();
  if (pErr) throw pErr;
  if (pulled.doc?.sections?.[0]?.items?.[0]?.text !== 'From device A') throw new Error('B did not see A edit');
  console.log('ok cross-device day sync');

  // offline-style LWW: B writes newer
  const docB = { ...docA, sections: [{ ...docA.sections[0], items: [{ id: 'item_live_1', text: 'From device B', time: '09:15', done: false }] }], updatedAt: new Date(Date.now() + 1000).toISOString() };
  await anonB.from('days').upsert({ user_id: userId, day_date: day, doc: docB, updated_at: docB.updatedAt });
  const { data: pulled2 } = await anonA.from('days').select('doc').eq('day_date', day).single();
  if (pulled2.doc.sections[0].items[0].text !== 'From device B') throw new Error('LWW failed');
  console.log('ok LWW');

  // calendar token + ICS
  const { data: token, error: tErr } = await anonA.rpc('ensure_calendar_token');
  if (tErr) throw tErr;
  const feed = `${env.SUPABASE_URL}/functions/v1/ics?token=${token}`;
  const res = await fetch(feed);
  if (!res.ok) throw new Error('ICS HTTP ' + res.status);
  const body = await res.text();
  if (!body.includes('BEGIN:VCALENDAR') || !body.includes('item_live_1@momos')) throw new Error('ICS missing event');
  // independent parse: count VEVENTs
  const vevents = (body.match(/BEGIN:VEVENT/g) || []).length;
  if (vevents < 1) throw new Error('no vevents');
  console.log('ok ICS feed', vevents, 'events');

  console.log('LIVE SYNC TESTS PASSED');
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    console.log('cleaned test user');
  }
}

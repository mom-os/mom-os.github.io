// Device pairing: create (JWT) / redeem (public, rate-limited).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1
const CODE_LEN = 8;
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX = 30;
const SITE = 'https://mom-os.github.io/';

function cors(req: Request) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

function normalizeCode(raw: string) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCode() {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function clientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return { error: 'Sign in required', status: 401 as const };
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SB_ANON_KEY') || '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    anon,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data.user) return { error: 'Sign in required', status: 401 as const };
  return { user: data.user };
}

async function handleCreate(req: Request) {
  const auth = await requireUser(req);
  if ('error' in auth) return json(req, { error: auth.error }, auth.status);

  const sb = adminClient();
  await sb.from('pairing_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', auth.user.id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString());

  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    const hash = await sha256Hex(code);
    const expires = new Date(Date.now() + TTL_MS).toISOString();
    const { error } = await sb.from('pairing_codes').insert({
      user_id: auth.user.id,
      code_hash: hash,
      expires_at: expires,
      max_attempts: MAX_ATTEMPTS,
    });
    if (!error) {
      return json(req, {
        code,
        display: `${code.slice(0, 4)}-${code.slice(4)}`,
        expires_at: expires,
        expires_in: Math.floor(TTL_MS / 1000),
        pair_url: `${SITE}#/style/account?pair=${code}`,
      });
    }
    if (error.code !== '23505') throw error;
  }
  return json(req, { error: 'Could not create a code — try again' }, 500);
}

async function checkIpRate(sb: ReturnType<typeof adminClient>, ip: string) {
  const ipHash = await sha256Hex(`ip:${ip}`);
  const since = new Date(Date.now() - IP_WINDOW_MS).toISOString();
  const { count, error } = await sb
    .from('pairing_redeem_rate')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if (error) throw error;
  if ((count || 0) >= IP_MAX) return { limited: true as const };
  await sb.from('pairing_redeem_rate').insert({ ip_hash: ipHash });
  return { limited: false as const };
}

async function mintSession(sb: ReturnType<typeof adminClient>, userId: string) {
  const { data: userData, error: userErr } = await sb.auth.admin.getUserById(userId);
  if (userErr || !userData?.user?.email) throw userErr || new Error('User missing email');
  const email = userData.user.email;

  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: SITE },
  });
  if (linkErr) throw linkErr;
  const otp = linkData?.properties?.email_otp as string | undefined;
  const hashed = linkData?.properties?.hashed_token as string | undefined;
  if (!otp && !hashed) throw new Error('Could not mint session');

  if (otp) {
    const { data: ver, error: verErr } = await sb.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (!verErr && ver.session) return ver.session;
  }
  const { data: ver2, error: ver2Err } = await sb.auth.verifyOtp({
    token_hash: hashed!,
    type: 'email',
  });
  if (ver2Err || !ver2.session) throw ver2Err || new Error('verify failed');
  return ver2.session;
}

async function handleRedeem(req: Request, body: { code?: string }) {
  const code = normalizeCode(body.code || '');
  if (code.length !== CODE_LEN) {
    return json(req, { error: 'Enter the 8-character code from your other device' }, 400);
  }

  const sb = adminClient();
  const rate = await checkIpRate(sb, clientIp(req));
  if (rate.limited) {
    return json(req, { error: 'Too many tries from this network. Wait a few minutes and try again.' }, 429);
  }

  const hash = await sha256Hex(code);
  const { data: row, error } = await sb
    .from('pairing_codes')
    .select('id, user_id, expires_at, used_at, attempts, max_attempts')
    .eq('code_hash', hash)
    .maybeSingle();
  if (error) throw error;

  if (!row) {
    return json(req, { error: 'That code didn’t work. Check the characters and try again.' }, 400);
  }

  const maxA = row.max_attempts ?? MAX_ATTEMPTS;
  const nextAttempts = (row.attempts || 0) + 1;

  if (row.used_at) {
    return json(req, { error: 'That code was already used. Create a new one on your signed-in device.' }, 400);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sb.from('pairing_codes').update({ used_at: new Date().toISOString(), attempts: nextAttempts }).eq('id', row.id);
    return json(req, { error: 'That code expired. Create a new one on your signed-in device.' }, 400);
  }
  if ((row.attempts || 0) >= maxA) {
    await sb.from('pairing_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    return json(req, { error: 'Too many wrong tries — this code is no longer valid.' }, 400);
  }

  // Reserve single-use before minting
  const { data: claimed, error: claimErr } = await sb
    .from('pairing_codes')
    .update({ used_at: new Date().toISOString(), attempts: nextAttempts })
    .eq('id', row.id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle();
  if (claimErr) throw claimErr;
  if (!claimed) {
    return json(req, { error: 'That code was already used. Create a new one on your signed-in device.' }, 400);
  }

  try {
    const session = await mintSession(sb, row.user_id);
    return json(req, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type || 'bearer',
      user: { id: session.user?.id, email: session.user?.email },
    });
  } catch (e) {
    console.error('mintSession failed', e);
    return json(req, { error: 'Could not finish linking. Create a new code and try again.' }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();
    if (action === 'create') return await handleCreate(req);
    if (action === 'redeem') return await handleRedeem(req, body);
    return json(req, { error: 'Unknown action' }, 400);
  } catch (e) {
    console.error(e);
    return json(req, { error: (e as Error)?.message || 'Server error' }, 500);
  }
});

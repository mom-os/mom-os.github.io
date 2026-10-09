import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

export const SITE = 'https://jblanchard87.github.io/momos';
export const OWNER_EMAILS = ['helllo.jordan@gmail.com'];

export function cors(req: Request) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

export function isOwnerEmail(email: string | undefined | null) {
  const e = (email || '').trim().toLowerCase();
  return OWNER_EMAILS.some((o) => o.toLowerCase() === e);
}

export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return { error: 'Sign in required', status: 401 as const };
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SB_ANON_KEY') || '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data.user) return { error: 'Sign in required', status: 401 as const };
  return { user: data.user };
}

export function priceIds() {
  return {
    monthly: Deno.env.get('STRIPE_PRICE_MONTHLY') || '',
    yearly: Deno.env.get('STRIPE_PRICE_YEARLY') || '',
    founding: Deno.env.get('STRIPE_PRICE_FOUNDING') || '',
  };
}

export function stripeSecret() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_TEST_SECRET_KEY') || '';
}

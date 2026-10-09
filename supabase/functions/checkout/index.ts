import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { cors, json, requireUser, isOwnerEmail, priceIds, stripeSecret, SITE, adminClient } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  const auth = await requireUser(req);
  if ('error' in auth) return json(req, { error: auth.error }, auth.status);

  const { user } = auth;
  if (isOwnerEmail(user.email)) {
    return json(req, { error: 'Owner account is free forever — no checkout needed.', code: 'owner_free' }, 400);
  }

  let body: { price?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const kind = (body.price || 'monthly').toLowerCase();
  const prices = priceIds();
  const map: Record<string, { id: string; mode: 'subscription' | 'payment'; lookup: string }> = {
    monthly: { id: prices.monthly, mode: 'subscription', lookup: 'momos_pro_monthly' },
    yearly: { id: prices.yearly, mode: 'subscription', lookup: 'momos_pro_yearly' },
    founding: { id: prices.founding, mode: 'payment', lookup: 'momos_founding_1' },
  };
  const pick = map[kind];
  if (!pick?.id) return json(req, { error: 'Unknown price' }, 400);

  const secret = stripeSecret();
  if (!secret) return json(req, { error: 'Stripe not configured' }, 500);

  const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia', httpClient: Stripe.createFetchHttpClient() });
  const admin = adminClient();

  // Reuse Stripe customer if we already have one
  const { data: subRow } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  let customerId = subRow?.stripe_customer_id || undefined;
  if (!customerId && user.email) {
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing.data[0]) customerId = existing.data[0].id;
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: pick.mode,
    line_items: [{ price: pick.id, quantity: 1 }],
    success_url: `${SITE}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/?checkout=cancel`,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      price_kind: kind,
      lookup_key: pick.lookup,
    },
    allow_promotion_codes: true,
  };
  if (customerId) sessionParams.customer = customerId;
  else if (user.email) sessionParams.customer_email = user.email;

  if (pick.mode === 'subscription') {
    sessionParams.subscription_data = {
      metadata: { supabase_user_id: user.id, lookup_key: pick.lookup },
    };
  } else {
    sessionParams.payment_intent_data = {
      metadata: { supabase_user_id: user.id, lookup_key: pick.lookup, kind: 'founding' },
    };
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    return json(req, { url: session.url, id: session.id, mode: Deno.env.get('STRIPE_MODE') || 'test' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Checkout failed';
    return json(req, { error: msg }, 500);
  }
});

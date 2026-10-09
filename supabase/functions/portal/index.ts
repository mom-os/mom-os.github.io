import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { cors, json, requireUser, isOwnerEmail, stripeSecret, SITE, adminClient } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  const auth = await requireUser(req);
  if ('error' in auth) return json(req, { error: auth.error }, auth.status);
  const { user } = auth;
  if (isOwnerEmail(user.email)) {
    return json(req, { error: 'Owner account has no subscription to manage.' }, 400);
  }

  const secret = stripeSecret();
  if (!secret) return json(req, { error: 'Stripe not configured' }, 500);
  const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia', httpClient: Stripe.createFetchHttpClient() });
  const admin = adminClient();
  const { data: row } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!row?.stripe_customer_id) return json(req, { error: 'No billing customer yet' }, 404);

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${SITE}/#/style/account`,
    });
    return json(req, { url: portal.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Portal failed';
    return json(req, { error: msg }, 500);
  }
});

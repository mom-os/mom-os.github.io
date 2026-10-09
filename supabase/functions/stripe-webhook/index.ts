import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { adminClient, stripeSecret } from '../_shared/billing.ts';

const FOUNDING_DAYS = 365;

function addDays(iso: Date, days: number) {
  const d = new Date(iso.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

async function upsertSub(userId: string, patch: Record<string, unknown>) {
  const admin = adminClient();
  const { data: existing } = await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  const row = {
    user_id: userId,
    plan: (patch.plan as string) || existing?.plan || 'free',
    founding_mom: patch.founding_mom ?? existing?.founding_mom ?? false,
    founding_expires_at: patch.founding_expires_at ?? existing?.founding_expires_at ?? null,
    stripe_customer_id: patch.stripe_customer_id ?? existing?.stripe_customer_id ?? null,
    stripe_subscription_id: patch.stripe_subscription_id ?? existing?.stripe_subscription_id ?? null,
    status: (patch.status as string) || existing?.status || 'none',
    price_lookup_key: patch.price_lookup_key ?? existing?.price_lookup_key ?? null,
    current_period_end: patch.current_period_end ?? existing?.current_period_end ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

async function userIdFromCustomer(stripe: Stripe, customerId: string | null, metaUser?: string | null) {
  if (metaUser) return metaUser;
  if (!customerId) return null;
  const admin = adminClient();
  const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
  if (data?.user_id) return data.user_id;
  const cust = await stripe.customers.retrieve(customerId);
  if (cust.deleted) return null;
  const fromMeta = (cust as Stripe.Customer).metadata?.supabase_user_id;
  return fromMeta || null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const secret = stripeSecret();
  const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  if (!secret || !whSecret) return new Response('Stripe webhook not configured', { status: 500 });

  const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia', httpClient: Stripe.createFetchHttpClient() });
  const sig = req.headers.get('stripe-signature') || '';
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'bad signature';
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;
        if (!userId) break;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const lookup = session.metadata?.lookup_key || session.metadata?.price_kind || '';
        const kind = session.metadata?.price_kind || '';

        if (session.mode === 'subscription') {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          let periodEnd: string | null = null;
          let status = 'active';
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            status = sub.status;
            periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
            await stripe.customers.update(customerId!, { metadata: { supabase_user_id: userId } });
          }
          await upsertSub(userId, {
            plan: status === 'active' || status === 'trialing' ? 'pro' : 'free',
            stripe_customer_id: customerId,
            stripe_subscription_id: subId,
            status,
            price_lookup_key: lookup || kind,
            current_period_end: periodEnd,
            founding_mom: false,
          });
        } else if (session.mode === 'payment') {
          // Founding Mom $1 — Pro for 12 months
          const expires = addDays(new Date(), FOUNDING_DAYS);
          if (customerId) {
            await stripe.customers.update(customerId, { metadata: { supabase_user_id: userId } });
          }
          await upsertSub(userId, {
            plan: 'pro',
            founding_mom: true,
            founding_expires_at: expires,
            stripe_customer_id: customerId,
            status: 'founding_active',
            price_lookup_key: 'momos_founding_1',
            current_period_end: expires,
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const userId = await userIdFromCustomer(stripe, customerId, sub.metadata?.supabase_user_id);
        if (!userId) break;
        const active = sub.status === 'active' || sub.status === 'trialing';
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const lookup = sub.items.data[0]?.price?.lookup_key || sub.metadata?.lookup_key || null;
        await upsertSub(userId, {
          plan: active ? 'pro' : 'free',
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          status: sub.status,
          price_lookup_key: lookup,
          current_period_end: periodEnd,
        });
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'handler error';
    console.error('webhook handler', msg);
    return new Response(msg, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

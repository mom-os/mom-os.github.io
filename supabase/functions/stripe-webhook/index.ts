import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { adminClient, stripeSecret, SITE } from '../_shared/billing.ts';
import { sendMail, smtpConfigured } from '../_shared/mail.ts';

const FOUNDING_DAYS = 365;

function addDays(iso: Date, days: number) {
  const d = new Date(iso.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function fmtDate(d: Date) {
  try {
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
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
    trial_used: patch.trial_used ?? existing?.trial_used ?? false,
    trial_ends_at: patch.trial_ends_at !== undefined ? patch.trial_ends_at : (existing?.trial_ends_at ?? null),
    trial_reminder_sent_at: patch.trial_reminder_sent_at !== undefined
      ? patch.trial_reminder_sent_at
      : (existing?.trial_reminder_sent_at ?? null),
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
  return (cust as Stripe.Customer).metadata?.supabase_user_id || null;
}

async function sendTrialEndingReminder(stripe: Stripe, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = await userIdFromCustomer(stripe, customerId, sub.metadata?.supabase_user_id);
  const admin = adminClient();

  if (userId) {
    const { data: row } = await admin.from('subscriptions').select('trial_reminder_sent_at').eq('user_id', userId).maybeSingle();
    if (row?.trial_reminder_sent_at) return; // already reminded
  }

  const cust = await stripe.customers.retrieve(customerId);
  if (cust.deleted) return;
  const email = (cust as Stripe.Customer).email;
  if (!email) {
    console.error('trial_will_end: no customer email');
    return;
  }

  const price = sub.items.data[0]?.price;
  const amountCents = price?.unit_amount ?? 0;
  const interval = price?.recurring?.interval;
  const amount = (amountCents / 100).toFixed(2);
  const chargeWhen = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const chargeLabel = chargeWhen ? fmtDate(chargeWhen) : 'soon';
  const period = interval === 'year' ? `$${amount}/year` : `$${amount}/month`;

  let manageUrl = `${SITE}/#/style/account`;
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE}/#/style/account`,
    });
    if (portal.url) manageUrl = portal.url;
  } catch (e) {
    console.error('portal session for reminder failed', e instanceof Error ? e.message : e);
  }

  const subject = 'Your Mom.OS Pro trial ends soon';
  const text = [
    'Hi — friendly heads-up from Mom.OS.',
    '',
    `Your 7-day Pro trial ends on ${chargeLabel}.`,
    `After that we’ll charge ${period} unless you cancel first.`,
    '',
    `Manage or cancel anytime (no guilt): ${manageUrl}`,
    '',
    'If Pro is earning its keep, you’re all set — nothing else to do.',
    'If not, cancel before the charge date and you’ll stay on Free.',
    '',
    '— Mom.OS',
    SITE,
  ].join('\n');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f1ee;font-family:Georgia,serif;color:#2c2a28;">
<div style="max-width:480px;margin:32px auto;padding:32px 28px;background:#fbfaf8;border:1px solid #e4e0da;border-radius:10px;">
<p style="margin:0 0 8px;font-family:system-ui,sans-serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#6e6964;">Mom.OS</p>
<h1 style="margin:0 0 16px;font-weight:500;font-size:26px;">Your Pro trial ends soon</h1>
<p style="margin:0 0 12px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#6e6964;">Friendly reminder — no surprises.</p>
<p style="margin:0 0 12px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;">Your 7-day trial ends on <b>${chargeLabel}</b>. After that we’ll charge <b>${period}</b> unless you cancel first.</p>
<p style="margin:24px 0;"><a href="${manageUrl}" style="display:inline-block;background:#3d6b6e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Manage or cancel</a></p>
<p style="margin:0;font-family:system-ui,sans-serif;font-size:13px;color:#a8a29c;">Cancel anytime before the charge date and you’ll stay on Free. If Pro is helping, you’re all set.</p>
</div></body></html>`;

  if (!smtpConfigured()) {
    console.error('trial_will_end: SMTP not configured — skipping email');
    return;
  }
  await sendMail({ to: email, subject, text, html });

  if (userId) {
    await upsertSub(userId, {
      trial_reminder_sent_at: new Date().toISOString(),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      trial_used: true,
      plan: 'pro',
    });
  }
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
          let trialEnds: string | null = null;
          let trialUsed = false;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            status = sub.status;
            periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
            if (sub.trial_end) {
              trialEnds = new Date(sub.trial_end * 1000).toISOString();
              trialUsed = true;
            }
            if (status === 'trialing' || status === 'active') trialUsed = true;
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
            trial_used: trialUsed,
            trial_ends_at: trialEnds,
          });
        } else if (session.mode === 'payment') {
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
            trial_used: true,
            trial_ends_at: null,
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
        const trialEnds = sub.trial_end && sub.status === 'trialing'
          ? new Date(sub.trial_end * 1000).toISOString()
          : (sub.status === 'trialing' ? null : null);
        await upsertSub(userId, {
          plan: active ? 'pro' : 'free',
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          status: sub.status,
          price_lookup_key: lookup,
          current_period_end: periodEnd,
          trial_used: !!(sub.trial_start || sub.trial_end) || active || sub.status === 'canceled',
          trial_ends_at: sub.status === 'trialing' && sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
        });
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        // Keep Pro during trial; send honest reminder
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const userId = await userIdFromCustomer(stripe, customerId, sub.metadata?.supabase_user_id);
        if (userId) {
          await upsertSub(userId, {
            plan: 'pro',
            status: sub.status || 'trialing',
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            trial_used: true,
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          });
        }
        try {
          await sendTrialEndingReminder(stripe, sub);
        } catch (e) {
          console.error('trial reminder email failed', e instanceof Error ? e.message : e);
          // Don't fail the webhook hard — Stripe will retry; still return 200 after logging
          throw e;
        }
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

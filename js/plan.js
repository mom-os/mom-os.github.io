/** Plan / owner entitlements + Stripe Checkout (TEST mode first). */
import { OWNER_EMAILS, SUPABASE_URL, SUPABASE_ANON_KEY, isFoundingOfferLive } from './config.js';
import { openPopover, closePopover } from './ui.js';
import { esc } from './util.js';
import { getSession, getSupabase } from './sync/client.js';

export const PRICE_MO = '$4.99/mo';
export const PRICE_YR = '$36/yr';
export const PRICE_FOUNDING = '$1 founding';
export const FREE_LOOK_IDS = new Set(['studio']);

export function isOwnerEmail(email) {
  const e = (email || '').trim().toLowerCase();
  return OWNER_EMAILS.some((o) => o.toLowerCase() === e);
}

export function isOwner(ctx) {
  return isOwnerEmail(ctx?.sync?.user?.email);
}

/** Forever-unlocked for owner; others need settings.plan === 'pro' from server subscriptions. */
export function isProUnlocked(ctx) {
  if (isOwner(ctx)) return true;
  const s = ctx?.store?.settings || {};
  if ((s.subscriptionStatus || '') === 'trialing') return true;
  if ((s.plan || 'free') !== 'pro') return false;
  // Founding Mom: honor expires_at when present
  if (s.foundingMom && s.foundingExpiresAt) {
    if (Date.parse(s.foundingExpiresAt) < Date.now()) return false;
  }
  return true;
}

export function shouldShowPaywall(ctx) {
  return !isProUnlocked(ctx);
}

export function planLabel(ctx) {
  if (isOwner(ctx)) return 'Founder · free forever';
  const s = ctx?.store?.settings || {};
  if (s.foundingMom && (s.plan || 'free') === 'pro') return 'Founding mom · Pro';
  if ((s.subscriptionStatus || '') === 'trialing') return 'Pro · free trial';
  if ((s.plan || 'free') === 'pro') return 'Pro';
  return 'Free';
}

export function planTierKey(ctx) {
  if (isOwner(ctx)) return 'founder';
  if ((ctx?.store?.settings?.plan || 'free') === 'pro') {
    return ctx.store.settings.foundingMom ? 'founding' : 'pro';
  }
  return 'free';
}

export const FREE_TEASER_PACKS = new Set(['sweet', 'mom', 'hustle', 'seasons', 'plant', 'witchy']);
export const PRO_PACK_IDS = new Set(['sports', 'business', 'sahm', 'newmama', 'military', 'resale', 'boudoir']);

export function packTier(packId) {
  if (FREE_TEASER_PACKS.has(packId)) return 'free';
  if (PRO_PACK_IDS.has(packId)) return 'pro';
  return 'free';
}
export function canUseLook(ctx, lookId) {
  if (isProUnlocked(ctx)) return true;
  return FREE_LOOK_IDS.has(lookId);
}

export function canUseFullPack(ctx, packId) {
  if (isProUnlocked(ctx)) return true;
  return packTier(packId) === 'free';
}

export function canUseProHabits(ctx) {
  return isProUnlocked(ctx);
}

export function ensurePlanSettings(settings) {
  if (!settings.plan) settings.plan = 'free';
  if (settings.foundingMom == null) settings.foundingMom = false;
  if (settings.foundingExpiresAt === undefined) settings.foundingExpiresAt = null;
  if (settings.trialEndsAt === undefined) settings.trialEndsAt = null;
  if (settings.subscriptionStatus === undefined) settings.subscriptionStatus = 'none';
  if (!settings.retention || typeof settings.retention !== 'object') {
    settings.retention = {
      streakCount: 0,
      streakLastDay: null,
      sundayPromptDismissedWeek: null,
      eodNudgeDismissedDay: null,
      seasonalBannerDismissed: null,
    };
  } else {
    const r = settings.retention;
    r.streakCount = Number(r.streakCount) || 0;
    r.streakLastDay ??= null;
    r.sundayPromptDismissedWeek ??= null;
    r.eodNudgeDismissedDay ??= null;
    r.seasonalBannerDismissed ??= null;
  }
  return settings;
}

const PRO_BENEFITS = [
  'Every Look in Style Studio',
  'Full sticker packs (beyond free teasers)',
  'Weekend Reset checklist',
  'Sunday Plan-your-week template',
  'Seasonal pack drops as they land',
];

export async function startCheckout(ctx, priceKind) {
  if (isOwner(ctx)) {
    ctx?.toast?.('Your founder account stays free forever');
    return;
  }
  const session = await getSession();
  if (!session?.access_token) {
    ctx?.toast?.('Sign in first — then unlock Pro');
    ctx?.go?.('#/style/account');
    return;
  }
  ctx?.toast?.('Opening secure checkout…');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ price: priceKind }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    ctx?.toast?.(data.error || 'Checkout unavailable — try again in a moment');
    return;
  }
  location.href = data.url;
}

export async function openBillingPortal(ctx) {
  if (isOwner(ctx)) {
    ctx?.toast?.('No subscription on the founder account');
    return;
  }
  const session = await getSession();
  if (!session?.access_token) {
    ctx?.toast?.('Sign in to manage billing');
    return;
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: '{}',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    ctx?.toast?.(data.error || 'Billing portal unavailable');
    return;
  }
  location.href = data.url;
}

/** Apply server subscriptions row onto local settings (source of truth). */
export function applySubscriptionRow(settings, row) {
  ensurePlanSettings(settings);
  if (!row) {
    // Signed-in users without a row stay free (ignore any client-stashed plan)
    settings.plan = 'free';
    settings.foundingMom = false;
    settings.foundingExpiresAt = null;
    settings.stripeCustomerId = null;
    settings.stripeSubscriptionId = null;
    settings.subscriptionStatus = 'none';
    settings.trialEndsAt = null;
    return settings;
  }
  let plan = row.plan || 'free';
  let founding = !!row.founding_mom;
  if (founding && row.founding_expires_at && Date.parse(row.founding_expires_at) < Date.now()) {
    plan = 'free';
    founding = false;
  }
  settings.plan = plan;
  settings.foundingMom = founding;
  settings.foundingExpiresAt = row.founding_expires_at || null;
  settings.stripeCustomerId = row.stripe_customer_id || null;
  settings.stripeSubscriptionId = row.stripe_subscription_id || null;
  settings.subscriptionStatus = row.status || 'none';
  settings.currentPeriodEnd = row.current_period_end || null;
  settings.trialEndsAt = row.trial_ends_at || null;
  // Trialling counts as Pro (server plan should already be pro)
  if (row.status === 'trialing') settings.plan = 'pro';
  return settings;
}

export function openProSheet(anchor, ctx, { reason = 'Mom.OS Pro', onClose } = {}) {
  const foundingLive = isFoundingOfferLive();
  const foundingBtn = foundingLive
    ? `<button class="btn ghost" data-pro="founding">Launch week · Founding Mom $1</button>`
    : '';
  const foundingFoot = foundingLive
    ? `<p class="pro-foot muted small">Launch week only (ends Oct 16): Founding Mom is $1 once — Pro for 12 months + a Founding badge. One free trial per person on monthly/yearly.</p>`
    : `<p class="pro-foot muted small">One free trial per person. Cancel anytime in Account → Manage subscription.</p>`;
  const html = `
    <div class="pro-sheet">
      <p class="pro-kicker">Mom.OS Pro</p>
      <h3 class="pro-title">${esc(reason)}</h3>
      <p class="pro-lead">Calm extras for the moms who want the full studio — still ADHD-friendly, never shouty.</p>
      <ul class="pro-benefits">${PRO_BENEFITS.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      <div class="pro-price">
        <span class="pro-best"><b>Best value:</b> $3/mo, billed $36/yr</span>
        <span class="muted small">or $4.99/mo</span>
        <small>Free for 7 days, then your plan price. Cancel anytime in Account. We’ll remind you before you’re charged.</small>
      </div>
      <div class="pro-actions">
        <button class="btn primary" data-pro="yearly">Start 7-day free trial · yearly</button>
        <button class="btn" data-pro="monthly">Start 7-day free trial · monthly</button>
        ${foundingBtn}
        <button class="btn ghost" data-pro="close">Not now</button>
      </div>
      ${foundingFoot}
    </div>`;
  const el = openPopover(anchor, html, { className: 'pro-pop', width: 340, onClose });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-pro]')?.dataset.pro;
    if (!a) return;
    if (a === 'close') { closePopover(); return; }
    if (a === 'monthly' || a === 'yearly' || a === 'founding') {
      closePopover();
      startCheckout(ctx, a);
    }
  });
  return el;
}

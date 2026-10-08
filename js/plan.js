/** Plan / owner entitlements. Stripe not wired — owner always unlocked; Pro UI ready. */
import { OWNER_EMAILS } from './config.js';
import { openPopover, closePopover } from './ui.js';
import { esc } from './util.js';

export const PRICE_MO = '$4.99/mo';
export const PRICE_YR = '$36/yr';
export const FREE_LOOK_IDS = new Set(['studio']);

export function isOwnerEmail(email) {
  const e = (email || '').trim().toLowerCase();
  return OWNER_EMAILS.some((o) => o.toLowerCase() === e);
}

export function isOwner(ctx) {
  return isOwnerEmail(ctx?.sync?.user?.email);
}

/** Forever-unlocked for owner; others need settings.plan === 'pro' (future Stripe). */
export function isProUnlocked(ctx) {
  if (isOwner(ctx)) return true;
  return (ctx?.store?.settings?.plan || 'free') === 'pro';
}

export function shouldShowPaywall(ctx) {
  return !isProUnlocked(ctx);
}

export function planLabel(ctx) {
  if (isOwner(ctx)) return 'Founder · free forever';
  const s = ctx?.store?.settings || {};
  if (s.foundingMom && (s.plan || 'free') === 'pro') return 'Founding mom · Pro';
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

/** Free teaser packs always available; lifestyle packs need Pro (soft lock in UI). */
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

/** Weekend Reset, Sunday week plan template — Pro habits. Streak + Top 3 stay free. */
export function canUseProHabits(ctx) {
  return isProUnlocked(ctx);
}

export function ensurePlanSettings(settings) {
  if (!settings.plan) settings.plan = 'free';
  if (settings.foundingMom == null) settings.foundingMom = false;
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

/** Polished Pro unlock sheet. No Stripe charge yet. */
export function openProSheet(anchor, ctx, { reason = 'Mom.OS Pro', onClose } = {}) {
  const html = `
    <div class="pro-sheet">
      <p class="pro-kicker">Mom.OS Pro</p>
      <h3 class="pro-title">${esc(reason)}</h3>
      <p class="pro-lead">Calm extras for the moms who want the full studio — still ADHD-friendly, never shouty.</p>
      <ul class="pro-benefits">${PRO_BENEFITS.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      <div class="pro-price">
        <span><b>${PRICE_MO}</b> or <b>${PRICE_YR}</b></span>
        <small>Cancel anytime · Stripe coming soon</small>
      </div>
      <div class="pro-actions">
        <button class="btn primary" data-pro="founding">Join founding moms</button>
        <button class="btn ghost" data-pro="soon">Coming soon</button>
        <button class="btn ghost" data-pro="close">Not now</button>
      </div>
      <p class="pro-foot muted small">Payments aren’t live yet. Founding moms get a badge when Stripe ships — you’ll hear from us first.</p>
    </div>`;
  const el = openPopover(anchor, html, { className: 'pro-pop', width: 340, onClose });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-pro]')?.dataset.pro;
    if (!a) return;
    if (a === 'close') { closePopover(); return; }
    if (a === 'soon') {
      ctx?.toast?.('Pro checkout coming soon — thanks for your patience');
      closePopover();
      return;
    }
    if (a === 'founding') {
      // Soft interest flag only — does not unlock Pro for free users (owner already unlocked).
      if (ctx?.store) {
        ensurePlanSettings(ctx.store.settings);
        ctx.store.settings.foundingInterest = true;
        ctx.store.settings.updatedAt = new Date().toISOString();
        ctx.store.commit('settings');
      }
      ctx?.toast?.('You’re on the founding list — we’ll email when Pro opens');
      closePopover();
    }
  });
  return el;
}

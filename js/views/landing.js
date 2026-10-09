/**
 * Public marketing + auth landing for Mom.OS.
 * Shown at #/ (and #/home) when the visitor is signed out and hasn't entered the app yet.
 */
import { esc } from '../util.js';
import { icon } from '../ui.js';
import { isSupabaseConfigured, SITE_URL } from '../config.js';
import { PRICE_MO, PRICE_YR, PRICE_FOUNDING, openProSheet } from '../plan.js';
import {
  sendSignInCode, verifySignInCode, redeemPairingCode, getSession,
} from '../sync/client.js';

const ENTERED_KEY = 'momos:entered-app';

export function hasEnteredApp() {
  try {
    if (localStorage.getItem(ENTERED_KEY) === '1') return true;
    // Existing installs (pre-landing) already have seeded planner data — skip marketing.
    const raw = localStorage.getItem('jb-planner:v1');
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.meta?.seeded) {
        localStorage.setItem(ENTERED_KEY, '1');
        return true;
      }
    }
  } catch {}
  return false;
}

export function markEnteredApp() {
  try { localStorage.setItem(ENTERED_KEY, '1'); } catch {}
}

export function isLandingHash(raw) {
  const h = (raw || '').replace(/^#\/?/, '').split('?')[0];
  return h === '' || h === 'home' || h === 'welcome' || h === 'landing';
}

function friendlyAuthError(err) {
  const msg = (err?.message || String(err) || '').toLowerCase();
  if (msg.includes('rate limit') || msg.includes('over_email') || msg.includes('email rate')) {
    return 'Sign-in email limit reached (about 2 per hour). Wait a bit, then try again — or use a device link code.';
  }
  if (msg.includes('rate') || msg.includes('security purposes') || msg.includes('too many')) {
    return err?.message || 'Please wait a minute before trying again.';
  }
  if (msg.includes('expired') || msg.includes('invalid') || msg.includes('otp')) {
    return err?.message || 'That code didn’t work. Check it, or ask for a new one.';
  }
  return err?.message || 'Something went wrong — try again.';
}

function featCard(img, title, body) {
  return `<article class="lp-feat">
    <div class="lp-feat-media">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}</div>
    <div class="lp-feat-copy"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>
  </article>`;
}

function authPanelHTML(ctx) {
  const pending = (ctx.landingPendingEmail || '').trim();
  const mode = ctx.landingAuthMode || 'email'; // email | code | pair
  if (!isSupabaseConfigured()) {
    return `<div class="lp-auth-card">
      <p class="muted">Cloud sign-in isn’t connected on this build. You can still <button type="button" class="linkish" data-lp="enter">open the planner</button> on this device.</p>
    </div>`;
  }
  if (mode === 'pair') {
    return `<div class="lp-auth-card" id="lp-auth">
      <h3>Link from another device</h3>
      <p class="muted">On a phone or computer that’s already signed in, open Style → Account → Link another device, then type that code here.</p>
      <label class="field"><span>8-character code</span>
        <input class="lp-pair" type="text" maxlength="12" autocomplete="one-time-code" placeholder="ABCD1234" enterkeyhint="done" value="${esc(ctx.landingPairDraft || '')}"></label>
      <div class="lp-auth-actions">
        <button class="btn primary" data-lp="pair-redeem">Link this device</button>
        <button class="btn ghost" data-lp="auth-email">Use email instead</button>
      </div>
    </div>`;
  }
  if (mode === 'code' && pending) {
    return `<div class="lp-auth-card" id="lp-auth">
      <h3>Enter your code</h3>
      <p class="muted">We sent a 6-digit code to <b>${esc(pending)}</b>.</p>
      <label class="field"><span>6-digit code</span>
        <input class="lp-code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="one-time-code" placeholder="••••••" enterkeyhint="done"></label>
      <div class="lp-auth-actions">
        <button class="btn primary" data-lp="verify">Verify &amp; open planner</button>
        <button class="btn ghost" data-lp="resend">Resend code</button>
        <button class="btn ghost" data-lp="auth-email">Different email</button>
      </div>
    </div>`;
  }
  return `<div class="lp-auth-card" id="lp-auth">
    <h3>Start free — or sign in</h3>
    <p class="muted">We’ll email a 6-digit code (and a link for desktop). No password.</p>
    <label class="field"><span>Email</span>
      <input class="lp-email" type="email" autocomplete="email" placeholder="you@example.com" enterkeyhint="send" value="${esc(ctx.landingDraftEmail || '')}"></label>
    <div class="lp-auth-actions">
      <button class="btn primary" data-lp="send">${ctx.landingIntent === 'signin' ? 'Sign in' : 'Start free'} — email my code</button>
      <button class="btn ghost" data-lp="have-code">I already have a code</button>
      <button class="btn ghost" data-lp="auth-pair">Have a code from another device?</button>
    </div>
  </div>`;
}

export function renderLanding(view, ctx) {
  document.body.classList.add('landing-mode');
  const configured = isSupabaseConfigured();

  view.innerHTML = `
  <div class="lp">
    <header class="lp-top">
      <a class="lp-brand" href="#/" aria-label="Mom.OS home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-name">MOM<span class="brand-dot">.</span>OS</span>
      </a>
      <nav class="lp-nav">
        <button type="button" class="lp-nav-link" data-lp-scroll="features">Features</button>
        <button type="button" class="lp-nav-link" data-lp-scroll="pricing">Pricing</button>
        <button type="button" class="lp-nav-link" data-lp-scroll="faq">FAQ</button>
        <button type="button" class="btn small ghost" data-lp="signin">Sign in</button>
        <button type="button" class="btn small primary" data-lp="start">Start free</button>
      </nav>
    </header>

    <section class="lp-hero">
      <div class="lp-hero-copy">
        <p class="lp-kicker">For ADHD moms · military spouses · work + hustle</p>
        <h1>The planner that thinks like a mom brain — and keeps up with it.</h1>
        <p class="lp-lead">Mom.OS is a calm desk planner on your phone and computer: today’s issues, meals, timed tasks with gentle reminders, lists, and an end-of-day wrap — without the guilt apps.</p>
        <div class="lp-hero-cta">
          <button type="button" class="btn primary large" data-lp="start">Start free</button>
          <button type="button" class="btn large" data-lp="signin">Sign in</button>
          <button type="button" class="btn ghost large" data-lp="enter">Open my planner</button>
        </div>
        <p class="lp-micro muted">Free forever for the core day. Pro unlocks Looks, full sticker packs, Weekend Reset &amp; Sunday plan.</p>
      </div>
      <div class="lp-hero-visual" aria-hidden="true">
        <div class="lp-device desk">
          <img src="assets/landing/feat-day.png" alt="" loading="eager" decoding="async">
        </div>
        <div class="lp-device phone">
          <img src="assets/landing/feat-phone.png" alt="" loading="eager" decoding="async">
        </div>
      </div>
    </section>

    <section class="lp-auth-band" aria-label="Sign in">
      ${authPanelHTML(ctx)}
    </section>

    <section class="lp-section" id="about">
      <h2>What it is</h2>
      <p class="lp-prose">Mom.OS feels like a paper desk planner — sections for <b>Today’s Issues</b>, <b>What Are We Eating</b>, and <b>Important Things To Do</b> — with a phone-first <b>My Day</b> timeline so the next thing is obvious. Same data on iPhone and PC when you sign in. Works offline; syncs when you’re back.</p>
    </section>

    <section class="lp-section" id="features">
      <h2>What you get</h2>
      <div class="lp-feat-grid">
        ${featCard('assets/landing/feat-day.png', 'Desk-style day pages', 'Today’s Issues, meals, and timed Important Things — color sections that stay readable.')}
        ${featCard('assets/landing/feat-myday.png', 'My Day + Top 3', 'A phone timeline with a gentle Top 3 focus strip so you’re not staring at an empty screen.')}
        ${featCard('assets/landing/feat-weekend.png', 'Lists & Weekend Reset', 'Grocery peeks, laundry, meal sketch — light checklists when the weekend hits.')}
        ${featCard('assets/landing/feat-eod.png', 'End of Day', 'A calm wrap: what went well, what carries over — no scorekeeping.')}
        ${featCard('assets/landing/feat-looks.png', 'Looks & sticker packs', 'Studio Look is free. Pro unlocks more Looks and full lifestyle sticker packs.')}
        ${featCard('assets/landing/feat-phone.png', 'Phone, PC & calendar', 'Sign in once. Link another device with a short code. Optional iCloud / Outlook feed with alarms.')}
      </div>
    </section>

    <section class="lp-section lp-helps" id="helps">
      <h2>How it helps</h2>
      <ul class="lp-points">
        <li><b>Fewer empty screens</b> — Top 3 and quick-add get you moving without a blank page stare-down.</li>
        <li><b>Gentle streaks</b> — “3-day rhythm,” never fire-and-shame. Miss a day? Start fresh.</li>
        <li><b>Weekend Reset</b> — a light Saturday/Sunday checklist (Pro) so the chaos has a landing pad.</li>
        <li><b>Sunday plan prompt</b> — two minutes to skim next week (Pro), dismissible, no lecture.</li>
        <li><b>Alarms that respect you</b> — reminders on timed lines; calendar feed for lock-screen when you subscribe.</li>
      </ul>
    </section>

    <section class="lp-section" id="pricing">
      <h2>Pricing</h2>
      <div class="lp-price-grid">
        <div class="lp-price-card">
          <p class="lp-price-label">Free</p>
          <p class="lp-price-amt">$0</p>
          <ul>
            <li>Day planner, Lists, End of Day</li>
            <li>My Day + Top 3 + gentle streaks</li>
            <li>Studio Look + teaser stickers</li>
            <li>Phone ↔ PC sync when signed in</li>
          </ul>
          <button type="button" class="btn primary" data-lp="start">Start free</button>
        </div>
        <div class="lp-price-card featured">
          <p class="lp-price-label">Pro</p>
          <p class="lp-price-amt">${esc(PRICE_MO)} <span>or ${esc(PRICE_YR)}</span></p>
          <ul>
            <li>Every Look in Style Studio</li>
            <li>Full sticker packs</li>
            <li>Weekend Reset + Sunday plan</li>
            <li>Seasonal pack drops</li>
          </ul>
          <button type="button" class="btn primary" data-lp="pro">See Pro unlock</button>
          <p class="muted small">Cancel anytime. Test card flow available while we stabilize billing.</p>
        </div>
        <div class="lp-price-card founding">
          <p class="lp-price-label">Founding Mom</p>
          <p class="lp-price-amt">${esc(PRICE_FOUNDING)}</p>
          <p>One-time early thanks — Pro for 12 months + a Founding badge.</p>
          <button type="button" class="btn" data-lp="pro">Join founding moms</button>
        </div>
      </div>
    </section>

    <section class="lp-section" id="faq">
      <h2>FAQ</h2>
      <div class="lp-faq">
        <details open><summary>Does it work on iPhone?</summary>
          <p>Yes. Open in Safari → Share → <b>Add to Home Screen</b> for the full-screen app. Sign in once (or link from a computer with a device code).</p></details>
        <details><summary>Does it work offline?</summary>
          <p>Yes. Your day stays on the device. When you’re online and signed in, edits sync across phones and PCs.</p></details>
        <details><summary>Can I put tasks on my calendar?</summary>
          <p>Signed-in accounts get a live calendar feed (webcal) for Apple Calendar / Outlook. Timed lines can include reminders (VALARM).</p></details>
        <details><summary>Can I cancel Pro anytime?</summary>
          <p>Yes. Manage or cancel from Account → Manage subscription. Free core stays available.</p></details>
        <details><summary>Is this childish sticker chaos?</summary>
          <p>No. Default is the professional <b>Studio</b> look — muted, readable, adult. Stickers and Looks are optional.</p></details>
      </div>
    </section>

    <footer class="lp-foot">
      <div class="lp-brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-name">MOM<span class="brand-dot">.</span>OS</span>
      </div>
      <p class="muted small">Made for moms who run a household and a life. © ${new Date().getFullYear()} Mom.OS</p>
      <p class="lp-foot-links">
        <button type="button" class="linkish" data-lp="enter">Open my planner</button>
        · <a href="${esc(SITE_URL)}">jblanchard87.github.io/momos</a>
      </p>
    </footer>
  </div>`;

  bindLanding(view, ctx);
}

function scrollToAuth(view) {
  view.querySelector('#lp-auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  view.querySelector('.lp-email, .lp-code, .lp-pair')?.focus();
}

function enterPlanner(ctx, hash = '#/myday') {
  markEnteredApp();
  document.body.classList.remove('landing-mode');
  if (typeof ctx.ensureSeeded === 'function') ctx.ensureSeeded();
  ctx.go(hash.startsWith('#/') ? hash : '#/myday');
}

function bindLanding(view, ctx) {
  const rerenderAuth = () => {
    const band = view.querySelector('.lp-auth-band');
    if (band) { band.innerHTML = authPanelHTML(ctx); }
  };

  view.addEventListener('click', async (e) => {
    const scrollEl = e.target.closest('[data-lp-scroll]');
    if (scrollEl) {
      const id = scrollEl.dataset.lpScroll;
      view.querySelector('#' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const el = e.target.closest('[data-lp]');
    if (!el) return;
    const act = el.dataset.lp;

    if (act === 'enter') return enterPlanner(ctx);
    if (act === 'start') {
      ctx.landingIntent = 'start';
      ctx.landingAuthMode = 'email';
      rerenderAuth();
      scrollToAuth(view);
      return;
    }
    if (act === 'signin') {
      ctx.landingIntent = 'signin';
      ctx.landingAuthMode = 'email';
      rerenderAuth();
      scrollToAuth(view);
      return;
    }
    if (act === 'pro') {
      // Need sign-in for checkout; open Pro sheet if signed in, else auth then hint
      const session = await getSession().catch(() => null);
      if (!session) {
        ctx.landingIntent = 'pro';
        ctx.landingAuthMode = 'email';
        rerenderAuth();
        scrollToAuth(view);
        ctx.toast('Sign in free first — then unlock Pro');
        return;
      }
      markEnteredApp();
      if (typeof ctx.ensureSeeded === 'function') ctx.ensureSeeded();
      document.body.classList.remove('landing-mode');
      ctx.go('#/style/looks');
      // slight delay so studio mounts
      setTimeout(() => {
        const anchor = document.querySelector('.look-card.locked, .studio-panel') || document.body;
        openProSheet(anchor, ctx, { reason: 'Mom.OS Pro' });
      }, 350);
      return;
    }
    if (act === 'auth-email') {
      ctx.landingAuthMode = 'email';
      ctx.landingPendingEmail = '';
      rerenderAuth();
      return;
    }
    if (act === 'auth-pair') {
      ctx.landingAuthMode = 'pair';
      rerenderAuth();
      scrollToAuth(view);
      return;
    }
    if (act === 'have-code') {
      const email = (view.querySelector('.lp-email')?.value || ctx.landingDraftEmail || '').trim();
      if (!email) { ctx.toast('Enter your email first'); return; }
      ctx.landingDraftEmail = email;
      ctx.landingPendingEmail = email;
      ctx.landingAuthMode = 'code';
      rerenderAuth();
      scrollToAuth(view);
      return;
    }
    if (act === 'send' || act === 'resend') {
      const email = (act === 'resend' ? ctx.landingPendingEmail : view.querySelector('.lp-email')?.value)?.trim() || '';
      if (!email || !email.includes('@')) { ctx.toast('Enter a valid email'); return; }
      el.disabled = true;
      try {
        ctx.landingDraftEmail = email;
        await sendSignInCode(email);
        ctx.landingPendingEmail = email;
        ctx.landingAuthMode = 'code';
        ctx.accountEmailRateLimited = false;
        rerenderAuth();
        ctx.toast('Code sent — check your email');
        scrollToAuth(view);
      } catch (err) {
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('rate') || msg.includes('email')) ctx.accountEmailRateLimited = true;
        ctx.toast(friendlyAuthError(err));
      } finally {
        el.disabled = false;
      }
      return;
    }
    if (act === 'verify') {
      const email = ctx.landingPendingEmail || '';
      const code = (view.querySelector('.lp-code')?.value || '').replace(/\s+/g, '');
      if (!email || code.length < 6) { ctx.toast('Enter the 6-digit code'); return; }
      el.disabled = true;
      try {
        await verifySignInCode(email, code);
        markEnteredApp();
        if (typeof ctx.ensureSeeded === 'function') ctx.ensureSeeded();
        ctx.toast('Signed in — opening your planner');
        document.body.classList.remove('landing-mode');
        // sync engine will pick up auth via onAuthChange; navigate
        ctx.go('#/myday');
        if (ctx.landingIntent === 'pro') {
          setTimeout(() => {
            ctx.go('#/style/looks');
            setTimeout(() => {
              const anchor = document.querySelector('.look-card.locked, .studio-panel') || document.body;
              openProSheet(anchor, ctx, { reason: 'Mom.OS Pro' });
            }, 400);
          }, 600);
        }
      } catch (err) {
        ctx.toast(friendlyAuthError(err));
      } finally {
        el.disabled = false;
      }
      return;
    }
    if (act === 'pair-redeem') {
      const raw = view.querySelector('.lp-pair')?.value || '';
      const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 8) { ctx.toast('Enter the 8-character code'); return; }
      el.disabled = true;
      try {
        await redeemPairingCode(code);
        markEnteredApp();
        if (typeof ctx.ensureSeeded === 'function') ctx.ensureSeeded();
        ctx.toast('Linked — syncing…');
        document.body.classList.remove('landing-mode');
        ctx.go('#/myday');
      } catch (err) {
        ctx.toast(friendlyAuthError(err));
      } finally {
        el.disabled = false;
      }
    }
  });

  view.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.classList.contains('lp-email')) {
      e.preventDefault();
      view.querySelector('[data-lp="send"]')?.click();
    } else if (e.target.classList.contains('lp-code')) {
      e.preventDefault();
      view.querySelector('[data-lp="verify"]')?.click();
    } else if (e.target.classList.contains('lp-pair')) {
      e.preventDefault();
      view.querySelector('[data-lp="pair-redeem"]')?.click();
    }
  });
}

/**
 * Public marketing + auth landing for Mom.OS.
 * Shown at #/ (and #/home) when the visitor is signed out and hasn't entered the app yet.
 */
import { esc } from '../util.js';
import { stickerHTML } from '../style/stickers.js';
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


function decoSticker(id, cls = '') {
  return stickerHTML('p:' + id, `lp-stk ${cls}`);
}

function realMomDayHTML() {
  const rows = [
    ['7:15a', 'School drop-off (shoes… where are the shoes?)', 'blush'],
    ['10:00a', 'Client call — gallery proofing', 'teal'],
    ['12:30p', 'Lunch + list five resale items', 'butter'],
    ['5:30p', 'Sheet-pan fajitas (yes, again — they work)', 'peach'],
    ['7:30p', 'Bath & bedtime → then your own quiet', 'lavender'],
  ];
  return `<ol class="lp-day-strip">
    ${rows.map(([time, text, c]) => `<li class="c-${c}"><time>${esc(time)}</time><span>${esc(text)}</span></li>`).join('')}
  </ol>`;
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
    <h3>Let’s get your day loaded</h3>
    <p class="muted">Email a 6-digit code (plus a desktop link). No password, no fuss.</p>
    <label class="field"><span>Email</span>
      <input class="lp-email" type="email" autocomplete="email" placeholder="you@example.com" enterkeyhint="send" value="${esc(ctx.landingDraftEmail || '')}"></label>
    <div class="lp-auth-actions">
      <button class="btn primary" data-lp="send">${ctx.landingIntent === 'signin' ? 'Sign in' : 'Start free'} — email my code</button>
      <button class="btn ghost" data-lp="have-code">I already have a code</button>
      <button class="btn ghost" data-lp="auth-pair">Have a code from another device?</button>
    </div>
  </div>`;
}


function detectInstallPlatform() {
  const ua = navigator.userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
  return 'windows';
}

function installStep(n, title, body) {
  return `<li class="lp-install-step">
    <span class="lp-step-num" aria-hidden="true">${n}</span>
    <div><b>${title}</b><p>${body}</p></div>
  </li>`;
}

function installGuideHTML(active = 'ios') {
  const tabs = [
    ['ios', 'iPhone'],
    ['android', 'Android'],
    ['windows', 'Windows'],
    ['mac', 'Mac'],
  ];
  const panels = {
    ios: `
      <div class="lp-install-visual" aria-hidden="true">
        <div class="lp-mock-phone"><span class="lp-mock-share" title="Share">⬆</span><span class="lp-mock-label">Share</span></div>
      </div>
      <ol class="lp-install-steps">
        ${installStep(1, 'Open in Safari', 'Go to <b>mom-os.github.io</b> in <b>Safari</b> (Chrome on iPhone won’t offer Add to Home Screen the same way).')}
        ${installStep(2, 'Tap Share', 'The square with the ↑ arrow at the bottom of Safari.')}
        ${installStep(3, 'Add to Home Screen', 'Scroll the sheet if needed → <b>Add to Home Screen</b> → <b>Add</b>.')}
      </ol>
      <p class="lp-install-note muted">You’ll get the black <b>M</b> icon on your home screen — tap it anytime, full-screen, like a real app.</p>`,
    android: `
      <div class="lp-install-visual" aria-hidden="true">
        <div class="lp-mock-phone android"><span class="lp-mock-menu">⋮</span><span class="lp-mock-label">Install</span></div>
      </div>
      <ol class="lp-install-steps">
        ${installStep(1, 'Open in Chrome', 'Visit <b>mom-os.github.io</b> in Chrome.')}
        ${installStep(2, 'Tap the menu', 'The <b>⋮</b> three-dot menu (top right).')}
        ${installStep(3, 'Add / Install', 'Choose <b>Add to Home screen</b> or <b>Install app</b>, then confirm.')}
      </ol>
      <p class="lp-install-note muted">Offline days still work; sync catches up when you’re back online.</p>`,
    windows: `
      <div class="lp-install-visual" aria-hidden="true">
        <div class="lp-mock-desk"><span class="lp-mock-omnibox">⊕ Install</span></div>
      </div>
      <ol class="lp-install-steps">
        ${installStep(1, 'Open in Chrome or Edge', 'Go to <b>mom-os.github.io</b>.')}
        ${installStep(2, 'Install icon', 'Click the <b>install</b> icon in the address bar — or open the browser menu → <b>Install Mom.OS</b> / <b>Apps</b> → <b>Install this site as an app</b>.')}
        ${installStep(3, 'Pin it', 'Launch from the Start menu or taskbar like any other app.')}
      </ol>
      <p class="lp-install-note muted">Works offline on your PC. When you’re online and signed in, edits sync to your phone.</p>`,
    mac: `
      <div class="lp-install-visual" aria-hidden="true">
        <div class="lp-mock-desk mac"><span class="lp-mock-omnibox">↓ Dock</span></div>
      </div>
      <ol class="lp-install-steps">
        ${installStep(1, 'Chrome', 'Open <b>mom-os.github.io</b> → click the <b>install</b> icon in the address bar → Install.')}
        ${installStep(2, 'Safari', 'Open the site in Safari → menu <b>File</b> → <b>Add to Dock</b> (macOS Sonoma+).')}
        ${installStep(3, 'Open from Dock', 'Launch Mom.OS from your Dock anytime — same planner, less browser clutter.')}
      </ol>
      <p class="lp-install-note muted">Signed in = same days on Mac and phone. Offline still works at the kitchen table.</p>`,
  };
  const tabBtns = tabs.map(([id, label]) =>
    `<button type="button" class="lp-install-tab ${id === active ? 'on' : ''}" data-lp-install-tab="${id}" aria-selected="${id === active}">${label}</button>`
  ).join('');
  const panelHtml = tabs.map(([id]) =>
    `<div class="lp-install-panel ${id === active ? 'on' : ''}" data-lp-install-panel="${id}" ${id === active ? '' : 'hidden'}>${panels[id]}</div>`
  ).join('');
  return `
  <section class="lp-section lp-tint-teal" id="install">
    <div class="lp-section-head">
      <h2>Get the app</h2>
      <p class="muted">Put Mom.OS on your phone &amp; computer — no app store needed.</p>
    </div>
    <div class="lp-install-pwa" hidden>
      <button type="button" class="btn primary large" data-lp="pwa-install">Install Mom.OS</button>
      <p class="muted small">One tap — your browser can install it right now.</p>
    </div>
    <div class="lp-install-tabs" role="tablist" aria-label="Choose your device">${tabBtns}</div>
    <div class="lp-install-body">${panelHtml}</div>
    <div class="lp-install-sync">
      <b>Then sign in on the new device</b>
      <p class="muted">Already signed in somewhere else? Open <b>Style → Account → Link another device</b>, grab the short code, and enter it here (or on the new phone). No need to dig through email again.</p>
    </div>
  </section>`;
}


export function renderLanding(view, ctx) {
  document.body.classList.add('landing-mode');
  const configured = isSupabaseConfigured();

  view.innerHTML = `
  <div class="lp lp-fun">
    <header class="lp-top">
      <a class="lp-brand" href="#/" aria-label="Mom.OS home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-name">MOM<span class="brand-dot">.</span>OS</span>
      </a>
      <nav class="lp-nav">
        <button type="button" class="lp-nav-link" data-lp-scroll="features">Features</button>
        <button type="button" class="lp-nav-link" data-lp-scroll="install">Install</button>
        <button type="button" class="lp-nav-link" data-lp-scroll="pricing">Pricing</button>
        <button type="button" class="lp-nav-link" data-lp-scroll="faq">FAQ</button>
        <button type="button" class="btn small ghost" data-lp="signin">Sign in</button>
        <button type="button" class="btn small primary" data-lp="start">Start free</button>
      </nav>
    </header>

    <section class="lp-hero">
      <div class="lp-float-stks" aria-hidden="true">
        ${decoSticker('coffee', 's1')}
        ${decoSticker('plantLeaf', 's2')}
        ${decoSticker('witchMoon', 's3')}
        ${decoSticker('bizLaptop', 's4')}
      </div>
      <div class="lp-hero-copy">
        <p class="lp-kicker">ADHD moms · military spouses · work + side hustle</p>
        <h1>For the mom running the house, the business, and <span class="lp-mark">47 browser tabs</span> in her brain.</h1>
        <p class="lp-lead">Mom.OS is your desk planner that actually fits a real day — meals, drop-offs, client calls, and the tiny wins — on phone and PC, without the guilt apps.</p>
        <div class="lp-hero-cta">
          <button type="button" class="btn primary large" data-lp="start">Start free</button>
          <button type="button" class="btn large" data-lp="signin">Sign in</button>
          <button type="button" class="btn ghost large" data-lp="enter">Open my planner</button>
        </div>
        <p class="lp-micro muted">Core day stays free. Pro adds Looks, full sticker packs, Weekend Reset &amp; Sunday plan.
          <button type="button" class="linkish" data-lp-scroll="install">How to get the app →</button></p>
      </div>
      <div class="lp-hero-visual" aria-hidden="true">
        <div class="lp-device desk">
          <img src="assets/landing/feat-day.png" alt="" loading="eager" decoding="async">
        </div>
        <div class="lp-device phone">
          <img src="assets/landing/feat-phone.png" alt="" loading="eager" decoding="async">
        </div>
        ${decoSticker('star', 's5')}
      </div>
    </section>

    <section class="lp-auth-band" aria-label="Sign in">
      ${authPanelHTML(ctx)}
    </section>

    <section class="lp-section lp-tint-teal" id="about">
      <h2>What it is <span class="lp-stk-inline" aria-hidden="true">${decoSticker('heart')}</span></h2>
      <p class="lp-prose">Paper-planner energy, phone-speed reality. <b>Today’s Issues</b>, <b>What Are We Eating</b>, <b>Important Things To Do</b> — plus a <b>My Day</b> timeline so “what’s next?” isn’t a scavenger hunt. Same stuff on iPhone and PC when you sign in. Works offline; syncs when you’re back.</p>
    </section>

    <section class="lp-section lp-tint-blush" id="realday">
      <div class="lp-section-head">
        <h2>A real mom day</h2>
        <p class="muted">Not a productivity fantasy — the messy middle, timed gently.</p>
      </div>
      ${realMomDayHTML()}
    </section>

    <section class="lp-section" id="features">
      <div class="lp-section-head">
        <h2>What you actually get</h2>
        <p class="muted">The tools that keep the day from becoming seventeen sticky notes.</p>
      </div>
      <div class="lp-feat-grid">
        ${featCard('assets/landing/feat-day.png', 'Desk-style day pages', 'Issues, dinner plans, timed to-dos — color blocks you can actually scan while someone’s yelling “MOM.”')}
        ${featCard('assets/landing/feat-myday.png', 'My Day + Top 3', 'Phone timeline + a Top 3 focus strip. Empty-screen freeze? We’ve got a gentle on-ramp.')}
        ${featCard('assets/landing/feat-weekend.png', 'Lists & Weekend Reset', 'Grocery peek, laundry, meal sketch — light checklists for the days that sprawl (Pro for Reset).')}
        ${featCard('assets/landing/feat-eod.png', 'End of Day', 'What went well, what carries over. Zero scorekeeping. Permission to close the laptop.')}
        ${featCard('assets/landing/feat-looks.png', 'Looks & stickers', 'Studio Look is free and grown-up. Pro unlocks more Looks and full packs — plant, witchy, hustle, the works.')}
        ${featCard('assets/landing/feat-phone.png', 'Phone, PC & calendar', 'Sign in once. Link another device with a short code. Optional iCloud / Outlook feed when you want lock-screen nudges.')}
      </div>
    </section>

    <section class="lp-section lp-helps" id="helps">
      <h2>How it helps a busy brain</h2>
      <ul class="lp-points">
        <li><b>Fewer empty screens</b> — Top 3 and quick-add beat the blank-page stare.</li>
        <li><b>Gentle streaks</b> — “3-day rhythm,” never fire-and-shame. Missed a day? Start fresh.</li>
        <li><b>Weekend Reset</b> — a soft Sat/Sun checklist (Pro) so chaos has a landing pad.</li>
        <li><b>Sunday plan prompt</b> — two minutes for next week (Pro). Dismissible. No lecture.</li>
        <li><b>Alarms that respect you</b> — reminders on timed lines; calendar feed when you want them louder.</li>
      </ul>
    </section>

    <section class="lp-section lp-tint-cream" id="founder">
      <div class="lp-founder">
        ${decoSticker('camera', 'founder-stk')}
        <div>
          <p class="lp-kicker">Built by a mom with ADHD</p>
          <h2>From one juggling act to another</h2>
          <p class="lp-prose">Hi — I’m Jordan. Mom of two, graphic designer, photographer, and reseller who got tired of planners that assumed I had a quiet desk and a free hour. Mom.OS is the desk planner I wanted: warm enough to enjoy, sturdy enough for drop-offs, client calls, and the seventeen tabs still open in my brain. Edit this note anytime — it’s your story too.</p>
        </div>
      </div>
    </section>

    <section class="lp-section" id="pricing">
      <div class="lp-section-head">
        <h2>Pricing that doesn’t guilt you</h2>
        <p class="muted">Start free. Upgrade when the extras earn their keep.</p>
      </div>
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
        <details open><summary>How do I get the app on my phone or computer?</summary>
          <p>No App Store needed — install from the browser. Jump to <button type="button" class="linkish" data-lp-scroll="install">Get the app</button> for iPhone, Android, Windows, and Mac steps. Then sign in or use <b>Link another device</b>.</p></details>
        <details><summary>Does it work on iPhone?</summary>
          <p>Yes. Open in <b>Safari</b> → Share → <b>Add to Home Screen</b> for the full-screen app. Sign in once (or link from a computer with a device code). Details in <button type="button" class="linkish" data-lp-scroll="install">Get the app</button>.</p></details>
        <details><summary>Does it work offline?</summary>
          <p>Yes. Your day stays on the device. When you’re online and signed in, edits sync across phones and PCs.</p></details>
        <details><summary>Can I put tasks on my calendar?</summary>
          <p>Signed-in accounts get a live calendar feed (webcal) for Apple Calendar / Outlook. Timed lines can include reminders (VALARM).</p></details>
        <details><summary>Can I cancel Pro anytime?</summary>
          <p>Yes. Manage or cancel from Account → Manage subscription. Free core stays available.</p></details>
        <details><summary>Is this childish sticker chaos?</summary>
          <p>Nope. The app defaults to professional <b>Studio</b> — muted and readable. Stickers are optional accents; this landing just shows a few so you can feel the vibe.</p></details>
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
        · <a href="${esc(SITE_URL)}">mom-os.github.io</a>
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
    const tab = e.target.closest('[data-lp-install-tab]');
    if (tab) {
      const id = tab.dataset.lpInstallTab;
      view.querySelectorAll('.lp-install-tab').forEach((b) => {
        const on = b.dataset.lpInstallTab === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      view.querySelectorAll('.lp-install-panel').forEach((panel) => {
        const on = panel.dataset.lpInstallPanel === id;
        panel.classList.toggle('on', on);
        panel.hidden = !on;
      });
      return;
    }
    const el = e.target.closest('[data-lp]');
    if (!el) return;
    const act = el.dataset.lp;

    if (act === 'pwa-install') {
      const deferred = ctx._pwaDeferred;
      if (!deferred) { ctx.toast('Use the steps below for your device'); return; }
      deferred.prompt();
      deferred.userChoice.finally(() => { ctx._pwaDeferred = null; view.querySelector('.lp-install-pwa')?.setAttribute('hidden', ''); });
      return;
    }
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

  // Native install prompt when the browser offers it
  const showPwa = () => {
    const box = view.querySelector('.lp-install-pwa');
    if (box && ctx._pwaDeferred) box.hidden = false;
  };
  if (ctx._pwaDeferred) showPwa();
  const onBip = (e) => {
    e.preventDefault();
    ctx._pwaDeferred = e;
    showPwa();
  };
  window.addEventListener('beforeinstallprompt', onBip);
  // tidy if view is replaced (clone drops this listener with the node; window listener is ok to stack lightly)
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

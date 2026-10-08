import { esc } from '../util.js';
import { isSupabaseConfigured, SITE_URL } from '../config.js';
import {
  sendSignInCode, verifySignInCode, signOut,
  createPairingCode, redeemPairingCode,
} from '../sync/client.js';
import { SyncStatus } from '../sync/engine.js';
import { renderSVG } from '../vendor/uqr.js';

const BUILD_TAG = '0.5.6';

const statusLabel = {
  [SyncStatus.Off]: 'Cloud off',
  [SyncStatus.SignedOut]: 'Not synced',
  [SyncStatus.Offline]: 'Offline',
  [SyncStatus.Syncing]: 'Syncing…',
  [SyncStatus.Synced]: 'Synced',
  [SyncStatus.Error]: 'Sync error',
};

export function syncChipHTML(sync) {
  if (!sync || sync.status === SyncStatus.Off) return '';
  if (sync.status === SyncStatus.SignedOut) {
    return `<button type="button" class="sync-chip status-signed_out subtle" data-go-account title="Sign in to sync across devices">
      <i class="sync-dot" aria-hidden="true"></i><span>Not synced</span></button>`;
  }
  const label = statusLabel[sync.status] || '…';
  const email = sync.user?.email ? esc(sync.user.email) : '';
  return `<button type="button" class="sync-chip status-${sync.status}" data-go-account title="${email}">
    <i class="sync-dot" aria-hidden="true"></i><span>${label}</span></button>`;
}

function pendingEmail(ctx) {
  return (ctx.accountPendingEmail || '').trim();
}

function pairDraft(ctx) {
  return (ctx.accountPairDraft || '').trim();
}

function activePair(ctx) {
  return ctx.accountPairing || null;
}

function pairRemainingLabel(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const m = Math.ceil(ms / 60000);
  return m <= 1 ? 'Expires in about a minute' : `Expires in about ${m} minutes`;
}

function qrSvgFor(url) {
  try {
    return renderSVG(url, { ecc: 'M', border: 2 });
  } catch {
    return '';
  }
}

/** Read ?pair= from hash query (e.g. #/style/account?pair=ABCD1234). */
export function peekPairQuery() {
  try {
    const hash = location.hash || '';
    const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const params = new URLSearchParams(q);
    const code = (params.get('pair') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return code.length === 8 ? code : '';
  } catch { return ''; }
}

export function clearPairQuery() {
  try {
    const hash = location.hash || '';
    if (!hash.includes('?')) return;
    const path = hash.slice(0, hash.indexOf('?'));
    history.replaceState(null, '', location.pathname + location.search + path);
  } catch {}
}

function signedOutPairBlock(ctx) {
  const draft = esc(pairDraft(ctx) || peekPairQuery());
  return `
    <div class="pair-card">
      <h3 class="panel-sub" style="margin-top:0">Have a code from another device?</h3>
      <p class="muted">On a phone or computer that’s already signed in, open Account → <b>Link another device</b>, then type that code here. No email needed.</p>
      <label class="field"><span>Device link code</span>
        <input class="acct-pair-code" type="text" inputmode="text" autocomplete="one-time-code"
          maxlength="12" placeholder="ABCD-EFGH" spellcheck="false" enterkeyhint="done"
          value="${draft}"></label>
      <div class="stack">
        <button class="btn primary" data-a="acct-redeem-pair">Link this device</button>
      </div>
    </div>
    <hr class="acct-divider">
    <h3 class="panel-sub">Or sign in with email</h3>`;
}

function pairingDisplayBlock(pair) {
  if (!pair) return '';
  const display = esc(pair.display || pair.code);
  const qr = qrSvgFor(pair.pair_url || `${SITE_URL}/#/style/account?pair=${pair.code}`);
  return `
    <div class="pair-active">
      <p class="muted">On the other device, open Mom.OS → Account and enter this code (or scan the QR):</p>
      <div class="pair-code-display" aria-label="Pairing code"><span>${esc((pair.code||'').slice(0,4))}</span><span class="pair-hyphen">-</span><span>${esc((pair.code||'').slice(4))}</span></div>
      <p class="muted small pair-expiry">${esc(pairRemainingLabel(pair.expires_at))}</p>
      ${qr ? `<div class="pair-qr" aria-hidden="true">${qr}</div>` : ''}
      <div class="menu-row">
        <button class="btn small primary" data-a="acct-copy-pair">Copy code</button>
        <button class="btn small ghost" data-a="acct-new-pair">New code</button>
        <button class="btn small ghost" data-a="acct-dismiss-pair">Done</button>
      </div>
      <p class="muted small">Codes work once and expire after 10 minutes. Keep this screen private.</p>
    </div>`;
}

export function panelAccount(ctx) {
  // Nudge SW update whenever Account is shown (stale handlers were a real bug)
  try { navigator.serviceWorker?.getRegistration?.().then((r) => r?.update?.()); } catch {}
  const sync = ctx.sync;
  const configured = isSupabaseConfigured();
  if (!configured) {
    return `<h2 class="panel-title">Account</h2>
      <p class="muted">Cloud sync isn’t connected yet. You can keep using Mom.OS on this device — everything stays in local storage.</p>`;
  }
  const user = sync?.user;
  const st = statusLabel[sync?.status] || '…';
  if (!user) {
    const pending = pendingEmail(ctx);
    if (pending) {
      const rateNote = ctx.accountEmailRateLimited
        ? `<p class="note-box">Email sending is temporarily limited (free plan allows about 2 sign-in emails per hour). If a code already arrived, enter it below. Otherwise wait about an hour and tap Resend.</p>`
        : `<p class="muted">We sent a 6-digit code to <b>${esc(pending)}</b>. Enter it here to sign in on this device — including the home-screen app on iPhone.</p>`;
      return `<h2 class="panel-title">Account</h2>
        ${rateNote}
        <p class="muted small">Code for <b>${esc(pending)}</b></p>
        <label class="field"><span>Enter the 6-digit code from your email</span>
          <input class="acct-code" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code"
            maxlength="8" placeholder="••••••" enterkeyhint="done"></label>
        <div class="stack">
          <button class="btn primary" data-a="acct-verify">Verify &amp; sign in</button>
          <button class="btn ghost" data-a="acct-resend">Resend code</button>
          <button class="btn ghost" data-a="acct-change-email">Use a different email</button>
        </div>
        <p class="muted small">On a computer you can also tap the link in the email. Prefer linking from a signed-in device? Go back and use a device link code.</p>`;
    }
    return `<h2 class="panel-title">Account</h2>
      <p class="muted small acct-build">App version Mom.OS ${BUILD_TAG}. If buttons do nothing, press Ctrl+Shift+R (hard refresh).</p>
      ${signedOutPairBlock(ctx)}
      <p class="muted">Email a sign-in code to sync across devices. Without an account, Mom.OS still works offline on this device.</p>
      <label class="field"><span>Email</span>
        <input class="acct-email" type="email" autocomplete="email" placeholder="you@example.com" enterkeyhint="send"
          value="${esc(ctx.accountDraftEmail || '')}"></label>
      <div class="stack">
        <button class="btn primary" data-a="acct-send-code">Email me a sign-in code</button>
        <button class="btn ghost" data-a="acct-have-email-code">I already have a code</button>
      </div>
      <p class="muted small">We’ll email a 6-digit code (and a link for desktop). No password. Free plan: about 2 sign-in emails per hour. On iPhone home-screen Mom.OS, after you’re signed in on a computer use <b>Link another device</b>.</p>`;
  }
  const feed = sync.feedUrl();
  const webcal = sync.webcalUrl();
  const pair = activePair(ctx);
  return `<h2 class="panel-title">Account</h2>
    <div class="acct-card">
      <div><b>${esc(user.email)}</b><small class="sync-line status-${sync.status}">${st}</small></div>
      <button class="btn small ghost" data-a="acct-signout">Sign out</button>
    </div>
    <p class="muted">Edits sync when you’re online. This device stays usable offline — changes upload when you reconnect.</p>

    <h3 class="panel-sub">Link another device</h3>
    <p class="muted">Sign in on your iPhone home-screen app (or another computer) without email — create a short code here, then enter it there.</p>
    ${pair ? pairingDisplayBlock(pair) : `
      <div class="stack">
        <button class="btn primary" data-a="acct-create-pair">Link another device</button>
      </div>`}

    <h3 class="panel-sub">Live calendar feed</h3>
    <p class="muted">Subscribe once; Apple Calendar / Outlook refresh on their own. Timed lines from the past 30 days through the next 180 days.</p>
    <label class="field"><span>Subscription link</span>
      <input class="acct-feed" readonly value="${esc(webcal || feed || '')}"></label>
    <div class="menu-row">
      <button class="btn small primary" data-a="acct-copy-feed">Copy link</button>
      <button class="btn small ghost" data-a="acct-rotate-feed">Reset link</button>
    </div>
    <div class="note-box">
      <b>iPhone (iCloud Calendar)</b><br>
      Tap the <code>webcal://</code> link, or Settings → Calendar → Accounts → Add Subscribed Calendar, paste the link, and save.<br><br>
      <b>Windows PC</b><br>
      In iCloud for Windows / Outlook: Add calendar → From internet, paste the same link (https:// also works).<br><br>
      <b>Reminders &amp; lock-screen alarms</b><br>
      Tap the bell on a timed line to set a reminder. The calendar feed / .ics export includes those alarms (VALARM). True lock-screen alarms on iPhone need this iCloud calendar subscription (or a future native app). In-app browser notifications only fire while Mom.OS is open or recently used — one notification per item, never spam.
    </div>`;
}

function friendlyAuthError(err) {
  const msg = (err?.message || String(err) || '').toLowerCase();
  if (msg.includes('rate limit') || msg.includes('over_email') || msg.includes('email rate')) {
    return 'Sign-in email limit reached (about 2 per hour on the free plan). Wait a bit, then try again — or use a device link code if another device is already signed in.';
  }
  if (msg.includes('rate') || msg.includes('security purposes') || msg.includes('after') || msg.includes('too many')) {
    return err?.message || 'Please wait a minute before trying again.';
  }
  if (msg.includes('expired')) return err.message;
  if (msg.includes('already used')) return err.message;
  if (msg.includes('invalid') || msg.includes('otp') || msg.includes('token') || msg.includes('didn’t work') || msg.includes('didn\'t work')) {
    return err?.message || 'That code didn’t work. Check it, or create a new one.';
  }
  return err?.message || String(err);
}

async function doCreatePair(ctx) {
  const data = await createPairingCode();
  ctx.accountPairing = {
    code: data.code,
    display: data.display,
    expires_at: data.expires_at,
    pair_url: data.pair_url,
  };
  ctx.toast('Code ready — enter it on the other device');
  ctx.rerender();
}


function setBusy(btn, on, labelWhenBusy) {
  if (!btn) return;
  if (on) {
    btn.dataset.prevLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    if (labelWhenBusy) btn.textContent = labelWhenBusy;
  } else {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    if (btn.dataset.prevLabel) { btn.textContent = btn.dataset.prevLabel; delete btn.dataset.prevLabel; }
  }
}

export function bindAccountActions(view, ctx) {
  // Prefill from QR / deep link once
  if (!ctx._pairQueryApplied) {
    const q = peekPairQuery();
    if (q) {
      ctx.accountPairDraft = q;
      ctx._pairQueryApplied = true;
    }
  }

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-a]');
    const a = btn?.dataset.a;
    if (!a || !a.startsWith('acct-')) return;
    e.preventDefault();
    const sync = ctx.sync;
    const busyActs = new Set(['acct-send-code', 'acct-resend', 'acct-verify', 'acct-create-pair', 'acct-new-pair', 'acct-redeem-pair', 'acct-signout', 'acct-rotate-feed']);
    if (busyActs.has(a)) {
      if (btn.disabled || btn.classList.contains('is-busy')) return;
      setBusy(btn, true, a === 'acct-verify' || a === 'acct-redeem-pair' ? 'Signing in…'
        : a === 'acct-send-code' || a === 'acct-resend' ? 'Sending…'
        : a === 'acct-create-pair' || a === 'acct-new-pair' ? 'Creating code…'
        : 'Working…');
    }
    try {
      if (a === 'acct-send-code' || a === 'acct-resend') {
        const email = (a === 'acct-resend' ? pendingEmail(ctx) : view.querySelector('.acct-email')?.value.trim()) || '';
        if (!email || !email.includes('@')) { ctx.toast('Enter a valid email'); return; }
        ctx.accountDraftEmail = email;
        try {
          await sendSignInCode(email);
          ctx.accountEmailRateLimited = false;
          ctx.accountPendingEmail = email;
          ctx.toast(a === 'acct-resend' ? 'New code sent — check your email' : 'Code sent — check your email');
        } catch (sendErr) {
          const m = (sendErr?.message || '').toLowerCase();
          if (m.includes('rate') || m.includes('over_email')) {
            ctx.accountEmailRateLimited = true;
            ctx.accountPendingEmail = email;
            ctx.toast(friendlyAuthError(sendErr));
            ctx.rerender();
            setTimeout(() => view.querySelector('.acct-code')?.focus(), 50);
            return;
          }
          throw sendErr;
        }
        ctx.rerender();
        setTimeout(() => view.querySelector('.acct-code')?.focus(), 50);
      } else if (a === 'acct-have-email-code') {
        const email = view.querySelector('.acct-email')?.value.trim() || ctx.accountDraftEmail || '';
        if (!email || !email.includes('@')) { ctx.toast('Enter your email first, then tap again'); return; }
        ctx.accountDraftEmail = email;
        ctx.accountPendingEmail = email;
        ctx.accountEmailRateLimited = false;
        ctx.toast('Enter the 6-digit code from your email');
        ctx.rerender();
        setTimeout(() => view.querySelector('.acct-code')?.focus(), 50);
      } else if (a === 'acct-verify') {
        const email = pendingEmail(ctx);
        const code = view.querySelector('.acct-code')?.value.trim();
        if (!email) { ctx.toast('Start with your email first'); return; }
        if (!code || code.replace(/\D/g, '').length < 6) { ctx.toast('Enter the 6-digit code'); return; }
        await verifySignInCode(email, code);
        ctx.accountPendingEmail = '';
        ctx.toast('Signed in — syncing…');
        ctx.rerender();
      } else if (a === 'acct-change-email') {
        ctx.accountPendingEmail = '';
        ctx.accountEmailRateLimited = false;
        ctx.rerender();
        setTimeout(() => view.querySelector('.acct-email')?.focus(), 50);
      } else if (a === 'acct-create-pair' || a === 'acct-new-pair') {
        await doCreatePair(ctx);
      } else if (a === 'acct-dismiss-pair') {
        ctx.accountPairing = null;
        ctx.rerender();
      } else if (a === 'acct-copy-pair') {
        const c = ctx.accountPairing?.code;
        if (!c) return;
        await navigator.clipboard.writeText(c);
        ctx.toast('Code copied');
      } else if (a === 'acct-redeem-pair') {
        const raw = view.querySelector('.acct-pair-code')?.value || pairDraft(ctx);
        const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code.length !== 8) { ctx.toast('Enter the 8-character code'); return; }
        ctx.accountPairDraft = code;
        await redeemPairingCode(code);
        ctx.accountPairDraft = '';
        clearPairQuery();
        ctx.toast('Linked — syncing…');
        ctx.rerender();
      } else if (a === 'acct-signout') {
        await signOut();
        ctx.accountPendingEmail = '';
        ctx.accountPairing = null;
        ctx.toast('Signed out — data stays on this device');
        ctx.rerender();
      } else if (a === 'acct-copy-feed') {
        const v = view.querySelector('.acct-feed')?.value;
        if (!v) { ctx.toast('No feed yet — try syncing first'); return; }
        await navigator.clipboard.writeText(v);
        ctx.toast('Subscription link copied');
      } else if (a === 'acct-rotate-feed') {
        await sync.rotateCalendarToken();
        ctx.toast('New link created — update your calendar subscription');
        ctx.rerender();
      } else {
        ctx.toast('That action isn’t available yet');
      }
    } catch (err) {
      ctx.toast(friendlyAuthError(err));
    } finally {
      if (busyActs.has(a) && btn?.isConnected) setBusy(btn, false);
    }
  });

  view.addEventListener('input', (e) => {
    if (e.target.classList.contains('acct-pair-code')) {
      // Auto-format ABCD-EFGH while typing
      const el = e.target;
      const clean = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const formatted = clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
      if (el.value !== formatted) {
        const pos = formatted.length;
        el.value = formatted;
        try { el.setSelectionRange(pos, pos); } catch {}
      }
      ctx.accountPairDraft = clean;
    }
  });

  view.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.classList.contains('acct-code')) {
      e.preventDefault();
      view.querySelector('[data-a="acct-verify"]')?.click();
    } else if (e.target.classList.contains('acct-email')) {
      e.preventDefault();
      view.querySelector('[data-a="acct-send-code"]')?.click();
    } else if (e.target.classList.contains('acct-pair-code')) {
      e.preventDefault();
      view.querySelector('[data-a="acct-redeem-pair"]')?.click();
    }
  });
}

import { esc } from '../util.js';
import { isSupabaseConfigured } from '../config.js';
import { sendSignInCode, verifySignInCode, signOut } from '../sync/client.js';
import { SyncStatus } from '../sync/engine.js';

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
  // Subtle when signed out
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

export function panelAccount(ctx) {
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
      return `<h2 class="panel-title">Account</h2>
        <p class="muted">We sent a 6-digit code to <b>${esc(pending)}</b>. Enter it here to sign in on this device — including the home-screen app on iPhone.</p>
        <label class="field"><span>Enter the 6-digit code from your email</span>
          <input class="acct-code" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code"
            maxlength="8" placeholder="••••••" enterkeyhint="done"></label>
        <div class="stack">
          <button class="btn primary" data-a="acct-verify">Verify &amp; sign in</button>
          <button class="btn ghost" data-a="acct-resend">Resend code</button>
          <button class="btn ghost" data-a="acct-change-email">Use a different email</button>
        </div>
        <p class="muted small">Tip: on a computer you can also tap the link in the email. On iPhone home-screen Mom.OS, the code is the reliable path.</p>`;
    }
    return `<h2 class="panel-title">Account</h2>
      <p class="muted">Sign in with your email to sync this planner across your iPhone and Windows PC. Without an account, Mom.OS still works offline on this device.</p>
      <label class="field"><span>Email</span>
        <input class="acct-email" type="email" autocomplete="email" placeholder="you@example.com" enterkeyhint="send"
          value="${esc(ctx.accountDraftEmail || '')}"></label>
      <div class="stack">
        <button class="btn primary" data-a="acct-send-code">Email me a sign-in code</button>
      </div>
      <p class="muted small">We’ll email a 6-digit code (and a link for desktop). No password.</p>`;
  }
  const feed = sync.feedUrl();
  const webcal = sync.webcalUrl();
  return `<h2 class="panel-title">Account</h2>
    <div class="acct-card">
      <div><b>${esc(user.email)}</b><small class="sync-line status-${sync.status}">${st}</small></div>
      <button class="btn small ghost" data-a="acct-signout">Sign out</button>
    </div>
    <p class="muted">Edits sync when you’re online. This device stays usable offline — changes upload when you reconnect.</p>
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
      In iCloud for Windows / Outlook: Add calendar → From internet, paste the same link (https:// also works).
    </div>`;
}

function friendlyAuthError(err) {
  const msg = (err?.message || String(err) || '').toLowerCase();
  if (msg.includes('rate') || msg.includes('security purposes') || msg.includes('after')) {
    return 'Please wait a minute before requesting another code — free-tier email is rate-limited.';
  }
  if (msg.includes('invalid') || msg.includes('otp') || msg.includes('token') || msg.includes('expired')) {
    return 'That code didn’t work. Check the digits, or resend a new code.';
  }
  return err?.message || String(err);
}

export function bindAccountActions(view, ctx) {
  view.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a || !a.startsWith('acct-')) return;
    const sync = ctx.sync;
    try {
      if (a === 'acct-send-code' || a === 'acct-resend') {
        const email = (a === 'acct-resend' ? pendingEmail(ctx) : view.querySelector('.acct-email')?.value.trim()) || '';
        if (!email || !email.includes('@')) { ctx.toast('Enter a valid email'); return; }
        ctx.accountDraftEmail = email;
        await sendSignInCode(email);
        ctx.accountPendingEmail = email;
        ctx.toast(a === 'acct-resend' ? 'New code sent — check your email' : 'Code sent — check your email');
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
        ctx.rerender();
        setTimeout(() => view.querySelector('.acct-email')?.focus(), 50);
      } else if (a === 'acct-signout') {
        await signOut();
        ctx.accountPendingEmail = '';
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
      }
    } catch (err) {
      ctx.toast(friendlyAuthError(err));
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
    }
  });
}

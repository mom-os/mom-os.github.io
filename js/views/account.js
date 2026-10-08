import { esc } from '../util.js';
import { icon } from '../ui.js';
import { isSupabaseConfigured } from '../config.js';
import { signInWithEmail, signOut } from '../sync/client.js';
import { SyncStatus } from '../sync/engine.js';

const statusLabel = {
  [SyncStatus.Off]: 'Cloud off',
  [SyncStatus.Offline]: 'Offline',
  [SyncStatus.Syncing]: 'Syncing…',
  [SyncStatus.Synced]: 'Synced',
  [SyncStatus.Error]: 'Sync error',
};

export function syncChipHTML(sync) {
  if (!sync || sync.status === SyncStatus.Off) return '';
  const label = statusLabel[sync.status] || '…';
  const email = sync.user?.email ? esc(sync.user.email) : 'Signed out';
  return `<button type="button" class="sync-chip status-${sync.status}" data-go-account title="${email}">
    <i class="sync-dot" aria-hidden="true"></i><span>${label}</span></button>`;
}

export function panelAccount(ctx) {
  const sync = ctx.sync;
  const configured = isSupabaseConfigured();
  if (!configured) {
    return `<h2 class="panel-title">Account</h2>
      <p class="muted">Cloud sync isn’t connected yet. You can keep using Mom.OS on this device — everything stays in local storage.</p>
      <p class="note-box">When Jordan finishes provisioning Supabase, sign-in and cross-device sync will light up here automatically.</p>`;
  }
  const user = sync?.user;
  const st = statusLabel[sync?.status] || '…';
  if (!user) {
    return `<h2 class="panel-title">Account</h2>
      <p class="muted">Sign in with a magic link to sync this planner across your iPhone and Windows PC. Without an account, Mom.OS still works offline on this device.</p>
      <label class="field"><span>Email</span>
        <input class="acct-email" type="email" autocomplete="email" placeholder="you@example.com" enterkeyhint="send"></label>
      <div class="stack">
        <button class="btn primary" data-a="acct-signin">Email me a sign-in link</button>
      </div>
      <p class="muted small">We’ll email a one-time link — no password. Open it on this device to finish signing in.</p>`;
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

export function bindAccountActions(view, ctx) {
  view.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a || !a.startsWith('acct-')) return;
    const sync = ctx.sync;
    try {
      if (a === 'acct-signin') {
        const email = view.querySelector('.acct-email')?.value.trim();
        if (!email || !email.includes('@')) { ctx.toast('Enter a valid email'); return; }
        await signInWithEmail(email);
        ctx.toast('Check your email for the sign-in link');
      } else if (a === 'acct-signout') {
        await signOut();
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
      ctx.toast(err.message || String(err));
    }
  });
}

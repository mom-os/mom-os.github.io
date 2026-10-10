/**
 * Gentle "Save your planner" nudge for signed-out users with local work.
 * Inline email OTP; dismissible at most once per calendar day (CT).
 */
import { filled } from './store.js';
import { sendSignInCode, verifySignInCode, getSession } from './sync/client.js';
import { track } from './analytics.js';
import { getVisitCount } from './analytics.js';
import { esc } from './util.js';

const DISMISS_KEY = 'momos:save-nudge-dismissed-day';

function todayCT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

export function countLocalItems(store) {
  try {
    const days = store?.state?.days || {};
    let n = 0;
    for (const day of Object.values(days)) {
      if (!day?.sections) continue;
      for (const s of day.sections) n += filled(s.items || []).length;
    }
    // lists live as days with list-like sections too; also month notes
    const notes = store?.state?.monthNotes || {};
    for (const arr of Object.values(notes)) {
      if (Array.isArray(arr)) n += arr.filter((x) => (x?.text || '').trim()).length;
    }
    return n;
  } catch { return 0; }
}

function dismissedToday() {
  try { return localStorage.getItem(DISMISS_KEY) === todayCT(); } catch { return false; }
}

function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, todayCT()); } catch {}
}

export function shouldShowSaveNudge(ctx) {
  if (ctx?.sync?.user) return false;
  if (dismissedToday()) return false;
  const items = countLocalItems(ctx?.store);
  const visits = getVisitCount();
  return items >= 3 || visits >= 2;
}

function friendlyAuthError(err) {
  const msg = (err?.message || String(err) || '').toLowerCase();
  if (msg.includes('rate') || msg.includes('email')) return 'Email is cooling off — try again in a bit, or use Link another device from a signed-in computer.';
  if (msg.includes('otp') || msg.includes('token') || msg.includes('code')) return 'That code didn’t work — check the digits or ask for a new one.';
  return 'Couldn’t sign in — try again in a moment.';
}

export function mountSaveNudge(ctx) {
  const existing = document.getElementById('save-nudge');
  if (existing) existing.remove();
  if (!shouldShowSaveNudge(ctx)) return null;

  const el = document.createElement('aside');
  el.id = 'save-nudge';
  el.className = 'save-nudge';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Save your planner');
  el.innerHTML = `
    <button type="button" class="save-nudge-x" data-sn="dismiss" aria-label="Dismiss">×</button>
    <p class="save-nudge-kicker">Mom.OS</p>
    <h3 class="save-nudge-title">Save your planner &amp; sync your phone</h3>
    <p class="save-nudge-lead">Create a free account (takes about 30 seconds). Everything you’ve already typed stays put — we just back it up.</p>
    <div class="save-nudge-auth" data-sn-panel="email">
      <label class="field"><span>Email</span>
        <input class="sn-email" type="email" autocomplete="email" placeholder="you@example.com" enterkeyhint="send"></label>
      <button type="button" class="btn primary" data-sn="send">Email me a code</button>
    </div>
    <div class="save-nudge-auth" data-sn-panel="code" hidden>
      <p class="muted small">Code sent to <b class="sn-pending"></b></p>
      <label class="field"><span>6-digit code</span>
        <input class="sn-code" type="text" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="123456"></label>
      <div class="save-nudge-row">
        <button type="button" class="btn primary" data-sn="verify">Save my planner</button>
        <button type="button" class="btn ghost" data-sn="resend">Resend</button>
      </div>
    </div>
    <button type="button" class="linkish save-nudge-later" data-sn="dismiss">Not now</button>
  `;
  document.body.appendChild(el);

  let pendingEmail = '';
  const panel = (name) => {
    el.querySelectorAll('[data-sn-panel]').forEach((p) => {
      p.hidden = p.getAttribute('data-sn-panel') !== name;
    });
  };

  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-sn]')?.dataset.sn;
    if (!act) return;
    if (act === 'dismiss') {
      markDismissed();
      el.remove();
      return;
    }
    if (act === 'send' || act === 'resend') {
      const email = (act === 'resend' ? pendingEmail : el.querySelector('.sn-email')?.value || '').trim();
      if (!email || !email.includes('@')) { ctx?.toast?.('Enter a valid email'); return; }
      const btn = e.target.closest('button');
      if (btn) btn.disabled = true;
      try {
        await sendSignInCode(email);
        pendingEmail = email;
        track('signin_code_sent', { path: location.hash || '#/', props_source: 'save_nudge' });
        el.querySelector('.sn-pending').textContent = email;
        panel('code');
        ctx?.toast?.('Code sent — check your email');
        el.querySelector('.sn-code')?.focus();
      } catch (err) {
        ctx?.toast?.(friendlyAuthError(err));
      } finally {
        if (btn) btn.disabled = false;
      }
      return;
    }
    if (act === 'verify') {
      const code = (el.querySelector('.sn-code')?.value || '').replace(/\s+/g, '');
      if (!pendingEmail || code.length < 6) { ctx?.toast?.('Enter the 6-digit code'); return; }
      const btn = e.target.closest('button');
      if (btn) btn.disabled = true;
      try {
        await verifySignInCode(pendingEmail, code);
        track('signup_complete', { path: location.hash || '#/', props_source: 'save_nudge' });
        markDismissed();
        el.remove();
        ctx?.toast?.('Saved — syncing your planner…');
        // SyncEngine onAuthChange will pull+push; nudge a push soon
        try { await ctx.sync?.pushLocal?.(); } catch {}
        try { await ctx.sync?.pullRemote?.(); } catch {}
        try { await ctx.sync?.pushLocal?.(); } catch {}
        const session = await getSession().catch(() => null);
        if (session) ctx?.toast?.('You’re signed in — phone sync is ready when you link a device');
      } catch (err) {
        ctx?.toast?.(friendlyAuthError(err));
      } finally {
        if (btn) btn.disabled = false;
      }
    }
  });

  return el;
}

/** Re-evaluate after store changes / route changes. */
export function refreshSaveNudge(ctx) {
  const showing = document.getElementById('save-nudge');
  if (ctx?.sync?.user) {
    showing?.remove();
    return;
  }
  if (showing) return; // already up
  if (shouldShowSaveNudge(ctx)) mountSaveNudge(ctx);
}

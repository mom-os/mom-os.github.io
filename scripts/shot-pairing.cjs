// NODE_PATH=/workspace/planner-tools/node_modules node scripts/shot-pairing.cjs [baseUrl]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const BASE = (process.argv[2] || 'https://jblanchard87.github.io/momos/').replace(/\/?$/, '/');
const OUT = path.join(__dirname, '..', 'screenshots');

function loadEnv() {
  const raw = fs.readFileSync('/workspace/planner-secrets/supabase.env', 'utf8');
  return Object.fromEntries(raw.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)];
  }));
}

(async () => {
  const env = loadEnv();
  const { createClient } = await import('file:///workspace/planner-app/js/vendor/supabase.js');
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `momos-shot-${Date.now()}@hotmail.com`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, email_confirm: true, password: 'ShotPair!9x_' + Date.now(),
  });
  if (cErr) throw cErr;
  const userId = created.user.id;
  const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const otp = linkData.properties.email_otp;

  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });

  {
    const bctx = await browser.newContext({
      viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Chicago',
    });
    const page = await bctx.newPage();
    page.on('pageerror', (e) => console.warn('pageerror', e.message));
    await page.goto(BASE + 'index.html#/style/account', { waitUntil: 'networkidle' });
    await page.evaluate(() => sessionStorage.setItem('hideSampleBanner', '1'));
    const signErr = await page.evaluate(async ({ email, otp, url, anon }) => {
      const mod = await import(new URL('./js/vendor/supabase.js', location.href).href);
      const sb = mod.createClient(url, anon);
      const { error } = await sb.auth.verifyOtp({ email, token: otp, type: 'email' });
      return error ? error.message : null;
    }, { email, otp, url: env.SUPABASE_URL, anon: env.SUPABASE_ANON_KEY });
    if (signErr) throw new Error('sign-in failed: ' + signErr);
    await page.waitForTimeout(1000);
    await page.goto(BASE + 'index.html#/style/account', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      sessionStorage.setItem('hideSampleBanner', '1');
      window.__planner?.ctx?.rerender?.();
    });
    await page.waitForTimeout(700);
    await page.locator('[data-a="acct-create-pair"]').waitFor({ timeout: 10000 });
    await page.locator('[data-a="acct-create-pair"]').click();
    await page.waitForSelector('.pair-code-display', { timeout: 12000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'live-pair-code-desktop.png'), fullPage: false });
    console.log('saved live-pair-code-desktop');
    await bctx.close();
  }

  {
    const bctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      timezoneId: 'America/Chicago', isMobile: true, hasTouch: true,
    });
    const page = await bctx.newPage();
    await page.goto(BASE + 'index.html#/style/account', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      sessionStorage.setItem('hideSampleBanner', '1');
      Object.keys(localStorage).filter((k) => k.includes('supabase') || k.includes('sb-'))
        .forEach((k) => localStorage.removeItem(k));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(BASE + 'index.html#/style/account', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      sessionStorage.setItem('hideSampleBanner', '1');
      const c = window.__planner?.ctx;
      if (c) { c.accountPairDraft = 'ABCD2345'; c.rerender(); }
    });
    await page.waitForSelector('.acct-pair-code', { timeout: 8000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'live-pair-entry-phone.png'), fullPage: false });
    console.log('saved live-pair-entry-phone');
    await bctx.close();
  }

  await browser.close();
  await admin.from('pairing_codes').delete().eq('user_id', userId);
  await admin.auth.admin.deleteUser(userId);
  console.log('cleaned shot user');
})().catch((e) => { console.error(e); process.exit(1); });

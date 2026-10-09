// NODE_PATH=/workspace/planner-tools/node_modules node scripts/shot-account-otp.cjs [baseUrl]
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.argv[2] || 'https://mom-os.github.io/';
const OUT = path.join(__dirname, '..', 'screenshots');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  async function shot(name, { width = 1440, height = 900, scale = 1, fullPage = false, before } = {}) {
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: scale,
      timezoneId: 'America/Chicago', isMobile: width < 500, hasTouch: width < 500,
    });
    const page = await ctx.newPage();
    await page.goto(BASE.replace(/\/?$/, '/') + 'index.html#/style/account', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { sessionStorage.setItem('hideSampleBanner', '1'); });
    // Clear any prior session so we show signed-out
    await page.evaluate(async () => {
      try {
        const keys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-'));
        keys.forEach(k => localStorage.removeItem(k));
      } catch {}
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(BASE.replace(/\/?$/, '/') + 'index.html#/style/account', { waitUntil: 'networkidle' });
    await page.evaluate(() => { sessionStorage.setItem('hideSampleBanner', '1'); window.__planner?.ctx?.rerender?.(); });
    await page.waitForTimeout(500);
    if (before) await before(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage });
    await ctx.close();
    console.log('saved', name);
  }

  const phone = { width: 390, height: 844, scale: 2, fullPage: false };

  // Signed out — chip should say Not synced
  await shot('live-account-signed-out', {
    before: async (p) => {
      // ensure on account; also capture chip by going to day first briefly if needed
      const chip = await p.locator('.sync-chip').textContent().catch(() => '');
      console.log('chip text:', JSON.stringify(chip));
    },
  });

  // Also shot day view with chip visible
  await shot('live-chip-not-synced', {
    before: async (p) => {
      await p.goto(BASE.replace(/\/?$/, '/') + 'index.html#/day/2026-10-08', { waitUntil: 'networkidle' });
      await p.evaluate(() => { sessionStorage.setItem('hideSampleBanner', '1'); window.__planner?.ctx?.rerender?.(); });
      await p.waitForTimeout(400);
      const chip = await p.locator('.sync-chip').textContent().catch(() => '');
      console.log('day chip:', JSON.stringify(chip));
    },
  });

  // Code-entry step (simulate pending email without sending)
  const enterCode = async (p) => {
    await p.evaluate(() => {
      const ctx = window.__planner.ctx;
      ctx.accountPendingEmail = 'demo@example.com';
      ctx.rerender();
    });
    await p.waitForTimeout(300);
    await p.waitForSelector('.acct-code', { timeout: 5000 });
  };

  await shot('live-account-code-entry-desktop', { before: enterCode });
  await shot('live-account-code-entry-phone', { ...phone, before: enterCode });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

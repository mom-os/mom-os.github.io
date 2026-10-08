const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = path.join(__dirname, '..', 'screenshots');

function freezeDate(isoLocal) {
  return `(function(){
    const Real = Date;
    const fixed = new Real(${JSON.stringify(isoLocal)});
    function Fake(...args) {
      if (args.length === 0) return new Real(fixed.getTime());
      if (args.length === 1) return new Real(args[0]);
      return new Real(...args);
    }
    Fake.now = () => fixed.getTime();
    Fake.parse = Real.parse; Fake.UTC = Real.UTC;
    Fake.prototype = Real.prototype;
    Object.setPrototypeOf(Fake, Real);
    window.Date = Fake;
  })()`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  async function shot(name, hash, { width = 1440, height = 900, scale = 1, fullPage = false, dateIso, before } = {}) {
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: scale,
      timezoneId: 'America/Chicago', isMobile: width < 500, hasTouch: width < 500,
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    if (dateIso) await page.addInitScript(freezeDate(dateIso));
    await page.goto(BASE + 'index.html' + hash, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__planner?.store, { timeout: 15000 });
    await page.evaluate(() => {
      sessionStorage.setItem('hideSampleBanner', '1');
      const store = window.__planner.store;
      store.updateStyle((s) => { s.themeId = 'studio'; s.lookId = 'studio'; }, { silent: true });
      store.settings.plan = 'free';
      store.settings.foundingMom = false;
      store.settings.retention = {
        streakCount: 3, streakLastDay: '2026-10-07',
        sundayPromptDismissedWeek: null, eodNudgeDismissedDay: null, seasonalBannerDismissed: null,
      };
      const key = '2026-10-08';
      store.mutateDay(key, (day) => {
        const todo = day.sections.find((s) => s.role === 'todo') || day.sections[0];
        const issues = day.sections.find((s) => s.role === 'issues') || day.sections[0];
        for (const [sec, text, time] of [
          [todo, 'Pediatrician call', '10:30'],
          [todo, 'Edit fall mini gallery', '14:00'],
          [issues, 'Pack soccer snacks', null],
        ]) {
          if (!sec.items.some((i) => i.text === text)) {
            sec.items.push({ id: 'ret_' + Math.random().toString(36).slice(2, 7), text, time, done: false, label: '', sticker: null, alarm: null });
          }
        }
      }, { silent: true });
      store.commit('settings', { silent: true });
      window.__planner.ctx.rerender();
    });
    if (before) await before(page);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage });
    await ctx.close();
    console.log('saved', name);
  }

  const phone = { width: 390, height: 844, scale: 2 };

  // finish retention if missing
  await shot('retention-streak-chip-phone', '#/myday/2026-10-08', {
    ...phone, dateIso: '2026-10-08T09:30:00',
    before: async (p) => { await p.waitForSelector('.streak-chip'); },
  });
  await shot('retention-weekend-reset', '#/day/2026-10-10', {
    dateIso: '2026-10-10T11:00:00',
    before: async (p) => { await p.waitForSelector('[data-act="weekend-reset"]'); },
  });
  await shot('retention-weekend-reset-phone', '#/myday/2026-10-10', {
    ...phone, dateIso: '2026-10-10T11:00:00',
    before: async (p) => { await p.waitForSelector('[data-act="weekend-reset"]'); },
  });
  await shot('retention-sunday-prompt', '#/myday/2026-10-11', {
    dateIso: '2026-10-11T10:00:00',
    before: async (p) => {
      await p.evaluate(() => { window.__planner.store.settings.retention.sundayPromptDismissedWeek = null; window.__planner.store.commit('settings', { silent: true }); window.__planner.ctx.rerender(); });
      await p.waitForSelector('.sunday-card');
    },
  });
  await shot('retention-sunday-prompt-phone', '#/myday/2026-10-11', {
    ...phone, dateIso: '2026-10-11T10:00:00',
    before: async (p) => {
      await p.evaluate(() => { window.__planner.store.settings.retention.sundayPromptDismissedWeek = null; window.__planner.store.commit('settings', { silent: true }); window.__planner.ctx.rerender(); });
      await p.waitForSelector('.sunday-card');
    },
  });

  // Pro sheet from locked Look
  await shot('retention-pro-sheet', '#/style/looks', {
    fullPage: false, dateIso: '2026-10-08T11:00:00',
    before: async (p) => {
      await p.waitForSelector('.look-card.locked');
      await p.click('.look-card.locked');
      await p.waitForSelector('.pro-sheet');
    },
  });
  await shot('retention-pro-sheet-phone', '#/style/looks', {
    ...phone, dateIso: '2026-10-08T11:00:00',
    before: async (p) => {
      await p.waitForSelector('.look-card.locked');
      await p.click('.look-card.locked');
      await p.waitForSelector('.pro-sheet');
    },
  });

  // Locked stickers panel
  await shot('retention-locked-stickers', '#/style/stickers', {
    fullPage: false, dateIso: '2026-10-08T11:00:00',
    before: async (p) => {
      await p.waitForSelector('.pack-locked, .pack-tier.pro');
      await p.evaluate(() => { const el = document.querySelector('.pack-locked'); el?.scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(200);
    },
  });
  await shot('retention-locked-looks', '#/style/looks', {
    fullPage: false, dateIso: '2026-10-08T11:00:00',
    before: async (p) => { await p.waitForSelector('.look-card.locked'); },
  });

  await browser.close();
  if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('no console errors');
})().catch((e) => { console.error(e); process.exit(1); });

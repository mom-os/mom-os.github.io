// NODE_PATH=/workspace/planner-tools/node_modules node scripts/shot-retention.cjs [baseUrl]
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = path.join(__dirname, '..', 'screenshots');

function freezeDate(isoLocal) {
  // isoLocal like '2026-10-11T10:00:00' interpreted as America/Chicago wall time via Date constructor in that TZ
  return `(function(){
    const Real = Date;
    const fixed = new Real(${JSON.stringify(isoLocal)});
    function Fake(a) {
      if (arguments.length === 0) return new Real(fixed.getTime());
      if (arguments.length === 1) return new Real(a);
      return new Real(...arguments);
    }
    Fake.now = () => fixed.getTime();
    Fake.parse = Real.parse; Fake.UTC = Real.UTC;
    Fake.prototype = Real.prototype;
    window.Date = Fake;
  })()`;
}

async function prepStudioLook(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('hideSampleBanner', '1');
    const store = window.__planner.store;
    store.updateStyle((s) => {
      s.themeId = 'studio';
      s.chrome = 'studio';
      if (s.lookId !== undefined) s.lookId = 'studio';
    }, { silent: true });
    // seed incomplete timed + important items for Top 3
    const key = '2026-10-08';
    store.mutateDay(key, (day) => {
      const issues = day.sections.find((s) => s.role === 'issues') || day.sections[0];
      const todo = day.sections.find((s) => s.role === 'todo') || day.sections[1] || day.sections[0];
      // clear sample noise lightly — just ensure a few incomplete
      const ensure = (sec, text, time) => {
        if (!sec.items.some((i) => i.text === text)) {
          sec.items.push({ id: 'ret_' + Math.random().toString(36).slice(2, 8), text, time: time || null, done: false, label: '', sticker: null, alarm: null });
        }
      };
      ensure(todo, 'Pediatrician call', '10:30');
      ensure(todo, 'Edit fall mini gallery', '14:00');
      ensure(issues, 'Pack soccer snacks', null);
    }, { silent: true });
    store.settings.retention = {
      streakCount: 3,
      streakLastDay: '2026-10-07',
      sundayPromptDismissedWeek: null,
      eodNudgeDismissedDay: null,
      seasonalBannerDismissed: null,
    };
    store.settings.plan = 'free';
    store.settings.updatedAt = new Date().toISOString();
    store.commit('settings', { silent: true });
    window.__planner.ctx.rerender();
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];

  async function shot(name, hash, { width = 1440, height = 900, scale = 1, fullPage = false, dateIso, before } = {}) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      timezoneId: 'America/Chicago',
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    if (dateIso) await page.addInitScript(freezeDate(dateIso));
    await page.goto(BASE + 'index.html' + hash, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.__planner && window.__planner.store, { timeout: 10000 });
    await prepStudioLook(page);
    if (before) await before(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage });
    await ctx.close();
    console.log('saved', name);
  }

  const phone = { width: 390, height: 844, scale: 2 };

  // Thu Oct 8 — focus + streak (yesterday streak → will show after touch; seed lastDay yesterday with count 3)
  // streakChip: if lastDay is yesterday and count>=2 shows "3-day rhythm" without needing completion today
  await shot('retention-myday-focus', '#/myday/2026-10-08', {
    dateIso: '2026-10-08T09:30:00',
    before: async (p) => {
      await p.evaluate(() => {
        const store = window.__planner.store;
        store.settings.retention.streakCount = 3;
        store.settings.retention.streakLastDay = '2026-10-07';
        store.commit('settings', { silent: true });
        window.__planner.ctx.rerender();
      });
      await p.waitForSelector('.focus-strip');
    },
  });
  await shot('retention-myday-focus-phone', '#/myday/2026-10-08', {
    ...phone,
    dateIso: '2026-10-08T09:30:00',
    before: async (p) => {
      await p.evaluate(() => {
        window.__planner.store.settings.retention.streakCount = 3;
        window.__planner.store.settings.retention.streakLastDay = '2026-10-07';
        window.__planner.store.commit('settings', { silent: true });
        window.__planner.ctx.rerender();
      });
      await p.waitForSelector('.focus-strip');
    },
  });

  // streak chip close-up on day view
  await shot('retention-streak-chip', '#/day/2026-10-08', {
    height: 720,
    dateIso: '2026-10-08T09:30:00',
    before: async (p) => {
      await p.evaluate(() => {
        window.__planner.store.settings.retention.streakCount = 3;
        window.__planner.store.settings.retention.streakLastDay = '2026-10-07';
        window.__planner.store.commit('settings', { silent: true });
        window.__planner.ctx.rerender();
      });
      await p.waitForSelector('.streak-chip');
    },
  });
  await shot('retention-streak-chip-phone', '#/myday/2026-10-08', {
    ...phone,
    dateIso: '2026-10-08T09:30:00',
    before: async (p) => {
      await p.evaluate(() => {
        window.__planner.store.settings.retention.streakCount = 3;
        window.__planner.store.settings.retention.streakLastDay = '2026-10-07';
        window.__planner.store.commit('settings', { silent: true });
        window.__planner.ctx.rerender();
      });
      await p.waitForSelector('.streak-chip');
    },
  });

  // Weekend reset — Saturday
  await shot('retention-weekend-reset', '#/day/2026-10-10', {
    dateIso: '2026-10-10T11:00:00',
    before: async (p) => {
      await p.evaluate(() => {
        window.__planner.ctx.focusDate = '2026-10-10';
        window.__planner.ctx.go('#/day/2026-10-10');
      });
      await p.waitForTimeout(400);
      await p.waitForSelector('[data-act="weekend-reset"]');
    },
  });
  await shot('retention-weekend-reset-phone', '#/myday/2026-10-10', {
    ...phone,
    dateIso: '2026-10-10T11:00:00',
    before: async (p) => {
      await p.waitForSelector('[data-act="weekend-reset"]');
    },
  });

  // Sunday plan prompt
  await shot('retention-sunday-prompt', '#/myday/2026-10-11', {
    dateIso: '2026-10-11T10:00:00',
    before: async (p) => {
      await p.evaluate(() => {
        window.__planner.store.settings.retention.sundayPromptDismissedWeek = null;
        window.__planner.store.commit('settings', { silent: true });
        window.__planner.ctx.rerender();
      });
      await p.waitForSelector('.sunday-card');
    },
  });
  await shot('retention-sunday-prompt-phone', '#/myday/2026-10-11', {
    ...phone,
    dateIso: '2026-10-11T10:00:00',
    before: async (p) => {
      await p.evaluate(() => {
        window.__planner.store.settings.retention.sundayPromptDismissedWeek = null;
        window.__planner.store.commit('settings', { silent: true });
        window.__planner.ctx.rerender();
      });
      await p.waitForSelector('.sunday-card');
    },
  });

  await browser.close();
  if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('no console errors');
})().catch((e) => { console.error(e); process.exit(1); });

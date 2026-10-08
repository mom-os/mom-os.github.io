// End-to-end checks of the Style studio. Usage:
// NODE_PATH=/workspace/planner-tools/node_modules node scripts/smoke-test-studio.cjs [baseUrl]
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const results = []; const ok = (n, c, x = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  (' + x + ')' : ''}`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const ST = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__planner.store.state.settings.style)));
  const cssVar = (v) => page.evaluate((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), v);
  const go = async (h) => { await page.goto(BASE + 'index.html' + h); await page.waitForTimeout(150); };

  // themes
  await go('#/style/themes');
  ok('13 preset themes listed', (await page.$$('.theme-card')).length >= 13, String((await page.$$('.theme-card')).length));
  await page.click('[data-pick="lavender"]');
  ok('pick preset theme restyles app', (await cssVar('--accent')) === '#a99bd0', await cssVar('--accent'));

  // colors -> auto custom copy
  await go('#/style/colors');
  await page.$eval('input[data-color="accent"]', (el) => { el.value = '#ff6699'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  let st = await ST();
  const cur = st.customThemes.find((t) => t.id === st.themeId);
  ok('editing a built-in creates a custom copy', !!cur && cur.colors.accent === '#ff6699', cur?.name);
  ok('custom accent applied live', (await cssVar('--accent')) === '#ff6699');
  await page.$eval('input[data-sec-color="teal"]', (el) => { el.value = '#112233'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  ok('section color editable', (await cssVar('--c-teal')) === '#112233');
  await page.fill('.c-name', 'Jordan Pink');
  st = await ST(); ok('rename custom theme', st.customThemes.some((t) => t.name === 'Jordan Pink'));
  await page.click('[data-a="dup-theme"]');
  st = await ST(); ok('duplicate theme', st.customThemes.length === 2, st.customThemes.map((t) => t.name).join(', '));
  await page.click('[data-a="del-theme"]'); await page.click('.popover [data-a="yes"]');
  st = await ST(); ok('delete theme', st.customThemes.length === 1 && st.themeId === 'blush');

  // fonts
  await go('#/style/fonts');
  await page.click('[data-font-cat="heading"][data-font="playfair"]');
  await page.click('[data-font-cat="body"][data-font="nunito"]');
  await page.click('[data-font-cat="script"][data-font="greatvibes"]');
  ok('fonts applied', (await cssVar('--font-head')).includes('Playfair') && (await cssVar('--font-ui')).includes('Nunito') && (await cssVar('--font-script')).includes('Great Vibes'));
  await page.evaluate(() => document.fonts.ready);
  ok('chosen web font actually loads', await page.evaluate(() => document.fonts.check("16px 'Great Vibes'")));

  // words
  await go('#/style/words');
  await page.fill('.hdr-title', 'Jordan plans');
  ok('rename app header', (await page.textContent('.brand-name')) === 'Jordan plans');
  await page.fill('.q-new', 'Boss mom energy.'); await page.press('.q-new', 'Enter');
  st = await ST(); ok('add own quote', st.quotes.custom.includes('Boss mom energy.'));
  await page.click('[data-quse="Boss mom energy."]');
  await go('#/day/2026-10-08');
  ok('fixed quote shows on day page', (await page.textContent('.day-title .script-quote')) === 'Boss mom energy.');

  // stickers: day / section / line
  await page.click('[data-act="day-sticker"]'); await page.click('.popover [data-v="p:star"]');
  await page.click('.section:nth-of-type(2) [data-act="sec-menu"]'); await page.click('.popover [data-m="sticker"]');
  await page.click('.popover [data-tab="emoji"]'); await page.click('.popover [data-v="e:🍕"]');
  await page.click('.section:nth-of-type(1) .line:nth-child(2) .add-time'); await page.click('.popover [data-stk]'); await page.click('.popover [data-tab="sweet"]');
  await page.click('.popover [data-v="p:heart"]');
  const day = await page.evaluate(() => window.__planner.store.state.days['2026-10-08']);
  ok('day sticker', day.stickers.includes('p:star'));
  ok('section sticker (emoji)', day.sections[1].sticker === 'e:🍕');
  ok('line sticker', day.sections[0].items[1].sticker === 'p:heart');
  await go('#/month/2026-10');
  ok('day stickers appear on month', (await page.$$('.mcell[data-day="2026-10-08"] .mc-stk .stk')).length >= 2);

  // layout
  await go('#/style/layout');
  await page.click('[data-layout="hourly"]');
  await page.click('[data-sw="l-spiral"]'); await page.click('[data-sw="l-notes"]');
  await page.click('[data-wstart="1"]');
  st = await ST(); ok('layout settings saved', st.layout.day === 'hourly' && !st.layout.spiral && !st.layout.notes && st.layout.weekStart === 1);
  await go('#/day/2026-10-09');
  ok('hourly day view renders', (await page.$$('.hour-row')).length >= 10);
  await page.click('.hour-row:nth-child(4) .hour-slot'); await page.keyboard.type('Hour test');
  const it = await page.evaluate(() => window.__planner.store.state.days['2026-10-09'].sections.flatMap((s) => s.items).find((i) => i.text === 'Hour test'));
  ok('tap an hour adds a timed line', it?.time === '09:00', it?.time);
  ok('notes column hidden', await page.$eval('.day-notes', (el) => getComputedStyle(el).display === 'none'));
  await go('#/month/2026-10');
  ok('week starts Monday', (await page.textContent('.mhead .full')) === 'Monday');
  ok('spiral hidden', await page.$eval('.month-page .spine', (el) => getComputedStyle(el).display === 'none'));

  // paper + background photo
  await go('#/style/paper');
  await page.click('[data-texture="dots"]'); await page.click('[data-stock-pick="kraft"]');
  ok('dot grid + kraft applied', await page.evaluate(() => document.documentElement.dataset.paper === 'dots' && document.documentElement.dataset.stock === 'kraft'));
  await page.setInputFiles('.bg-file', path.join(__dirname, 'assets/sample-background.jpg'));
  await page.waitForTimeout(800);
  const bgLen = await page.evaluate(() => (localStorage.getItem('jb-planner:bg-image') || '').length);
  ok('background photo uploaded (resized data URL)', bgLen > 1000 && (await page.evaluate(() => document.documentElement.classList.contains('has-bg-image'))), `${Math.round(bgLen / 1024)} KB`);

  // persistence
  await page.reload(); await page.waitForTimeout(200);
  st = await ST(); ok('style persists after reload', st.paper.stock === 'kraft' && st.fonts.heading === 'playfair' && st.header.title === 'Jordan plans');

  // share: export -> reset -> import
  await go('#/style/share');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="style-export"]')]);
  const file = '/tmp/planner-style-test.json'; await dl.saveAs(file);
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('style exported as JSON', payload.type === 'jb-planner-style' && payload.style.fonts.heading === 'playfair', dl.suggestedFilename());
  await page.click('[data-a="style-reset"]');
  st = await ST(); ok('reset style to default', st.themeId === 'blush' && st.fonts.heading === 'auto' && st.paper.stock === 'smooth' && st.customThemes.length === 1);
  await page.setInputFiles('.style-import', file); await page.waitForTimeout(300);
  st = await ST(); ok('import style JSON restores look', st.fonts.heading === 'playfair' && st.paper.stock === 'kraft' && st.layout.day === 'hourly');
  const days = await page.evaluate(() => Object.keys(window.__planner.store.state.days).length);
  ok('style reset/import never touches planner data', days >= 3, `${days} days kept`);

  ok('no console/page errors', errs.length === 0, errs.join(' / '));
  console.log(results.join('\n'));
  await browser.close();
  if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
})();

// End-to-end checks of the main interactions. Usage:
// NODE_PATH=/workspace/planner-tools/node_modules node scripts/smoke-test.cjs [baseUrl]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const results = [];
const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, timezoneId: 'America/Chicago' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__planner.store.state)));

  await page.goto(BASE + 'index.html#/day/2026-10-09');
  let st = await S();
  ok('sample seeded for Oct 8 + Oct 10', !!st.days['2026-10-08'] && !!st.days['2026-10-10']);
  ok('untouched day is not saved yet', !st.days['2026-10-09']);

  // add lines with click + Enter
  await page.click('.section:nth-of-type(1) .add-line');
  await page.keyboard.type('Test item one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Test item two');
  st = await S();
  const issues = st.days['2026-10-09']?.sections[0].items.map((i) => i.text);
  ok('add line + Enter creates next line', JSON.stringify(issues) === JSON.stringify(['Test item one', 'Test item two']), JSON.stringify(issues));

  await page.click('.section:nth-of-type(1) .line:first-child .check');
  st = await S();
  ok('check off a line', st.days['2026-10-09'].sections[0].items[0].done === true);

  // timed line in Important Things To Do
  await page.click('.section:nth-of-type(3) .add-line');
  await page.keyboard.type('Dentist call');
  await page.click('.section:nth-of-type(3) .line:first-child .time-pill');
  await page.click('.popover .chip[data-t="12:00"]');
  st = await S();
  ok('set a time via time picker', st.days['2026-10-09'].sections[2].items[0].time === '12:00');

  // add + rename + recolor a section
  await page.click('[data-act="add-section"]');
  await page.fill('.popover .f-title', 'Reselling');
  await page.click('.popover [data-color="peach"]');
  await page.click('.popover [data-m="done"]');
  st = await S();
  const last = st.days['2026-10-09'].sections.at(-1);
  ok('add/rename/recolor section', last.title === 'Reselling' && last.color === 'peach', `${last.title}/${last.color}`);

  // reorder: move Reselling up
  await page.click('.section:nth-of-type(4) [data-act="sec-menu"]');
  await page.click('.popover [data-m="up"]');
  st = await S();
  ok('move section up', st.days['2026-10-09'].sections[2].title === 'Reselling');

  // save weekday template, check a fresh Monday picks it up and Sunday doesn't
  await page.click('[data-act="save-tpl"][data-kind="weekday"]');
  await page.goto(BASE + 'index.html#/day/2026-10-12');
  const monTitles = await page.$$eval('.section h2', (h) => h.map((x) => x.textContent));
  ok('weekday template applied to new Monday', monTitles.includes('Reselling'), monTitles.join(' | '));
  await page.goto(BASE + 'index.html#/day/2026-10-11');
  const sunTitles = await page.$$eval('.section h2', (h) => h.map((x) => x.textContent));
  const sunMeals = await page.$$eval('.section:nth-of-type(2) .slot-label', (h) => h.map((x) => x.textContent));
  ok('weekend template on Sunday (meals x4 + Sessions)', sunTitles.includes('Sessions') && sunMeals.length === 4, sunTitles.join(' | '));

  // persistence
  await page.reload();
  st = await S();
  ok('data persists after reload', st.days['2026-10-09']?.sections.length === 4 && st.templates.weekday.length === 4);

  // My Day quick add with time parsing
  await page.goto(BASE + 'index.html#/myday/2026-10-09');
  await page.fill('.quick-add input', 'call mom 7pm');
  await page.press('.quick-add input', 'Enter');
  st = await S();
  const todo = st.days['2026-10-09'].sections.find((s) => s.role === 'todo').items.find((i) => i.text === 'call mom');
  ok('quick add "call mom 7pm" -> 7:00 pm in Important Things', todo?.time === '19:00');
  const order = await page.$$eval('.timeline .md-row', (r) => r.map((x) => x.querySelector('.md-time').textContent));
  ok('My Day timeline is chronological', order.join(',') === [...order].sort((a, b) => { const m = (t) => { const x = t.match(/(\d+)(?::(\d+))?([ap])/); return (Number(x[1]) % 12 + (x[3] === 'p' ? 12 : 0)) * 60 + Number(x[2] || 0); }; return m(a) - m(b); }).join(','), order.join(','));

  // ICS export (week containing Oct 8)
  await page.goto(BASE + 'index.html#/day/2026-10-08');
  await page.click('.head-actions [data-act="export"]');
  await page.click('.popover [data-k="week"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.popover [data-go="icsDownload"]')]);
  const icsPath = '/tmp/planner-week-test.ics';
  await dl.saveAs(icsPath);
  const ics = fs.readFileSync(icsPath, 'utf8');
  ok('week .ics downloaded', dl.suggestedFilename() === 'planner-week-2026-10-04.ics' && ics.includes('BEGIN:VCALENDAR'), dl.suggestedFilename());
  ok('ics uses America/Chicago TZID', ics.includes('DTSTART;TZID=America/Chicago:20261008T140000'));

  // clear sample + undo
  await page.click('[data-sb="clear"]');
  st = await S();
  ok('clear sample removes sample days, keeps real ones', !st.days['2026-10-08'] && !st.days['2026-10-10'] && !!st.days['2026-10-09'] && !st.meta.sampleActive);
  await page.click('.toast-btn');
  st = await S();
  ok('undo restores sample', !!st.days['2026-10-08']);

  // theme switch
  await page.goto(BASE + 'index.html#/style');
  await page.click('[data-pick="moody"]');
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  ok('theme picker restyles app', theme === 'moody');

  // service worker registered
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  ok('service worker active', sw);

  ok('no console/page errors', errs.length === 0, errs.join(' / '));
  console.log(results.join('\n'));
  await browser.close();
  if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
})();

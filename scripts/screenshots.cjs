// Usage: NODE_PATH=/workspace/planner-tools/node_modules node scripts/screenshots.cjs [baseUrl]
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = path.join(__dirname, '..', 'screenshots');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  async function shot(name, hash, { width = 1440, height = 900, scale = 1, theme, fullPage = true, before } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, timezoneId: 'America/Chicago',
      isMobile: width < 500, hasTouch: width < 500 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.goto(BASE + 'index.html' + hash);
    await page.evaluate(() => document.fonts.ready);
    if (theme) { await page.evaluate((t) => window.__planner.store.updateStyle((s) => { s.themeId = t; }), theme); }
    if (before) await before(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage });
    await ctx.close();
    console.log('saved', name);
  }
  await shot('desktop-month', '#/month/2026-10');
  await shot('desktop-day-weekday', '#/day/2026-10-08');
  await shot('desktop-day-weekend', '#/day/2026-10-10');
  await shot('desktop-myday', '#/myday/2026-10-08');
  const phone = { width: 390, height: 844, scale: 2, fullPage: false };
  const hideBanner = async (p) => { await p.evaluate(() => { sessionStorage.setItem('hideSampleBanner', '1'); window.__planner.ctx.rerender(); }); };
  await shot('phone-day', '#/day/2026-10-08', { ...phone, before: hideBanner });
  await shot('phone-day-scrolled', '#/day/2026-10-08', { ...phone, before: async (p) => { await hideBanner(p); await p.evaluate(() => window.scrollTo(0, 520)); } });
  await shot('phone-day-weekend', '#/day/2026-10-10', { ...phone, before: hideBanner });
  await shot('phone-myday', '#/myday/2026-10-08', { ...phone, before: hideBanner });
  await shot('phone-myday-scrolled', '#/myday/2026-10-08', { ...phone, before: async (p) => { await hideBanner(p); await p.evaluate(() => window.scrollTo(0, 99999)); } });
  await shot('phone-month', '#/month/2026-10', { ...phone, before: hideBanner });
  await shot('theme-picker', '#/style', { fullPage: false });
  await shot('phone-theme-picker', '#/style', { width: 390, height: 844, scale: 2, fullPage: false });
  // the same planner in the other styles
  await shot('theme-moody-month', '#/month/2026-10', { theme: 'moody' });
  await shot('theme-linen-day-weekend', '#/day/2026-10-10', { theme: 'linen' });
  await shot('theme-sage-phone-myday', '#/myday/2026-10-10', { ...phone, theme: 'sage', before: hideBanner });
  // ---------- phase 2: style studio ----------
  await shot('studio-desktop-themes', '#/style/themes', { fullPage: false, before: hideBanner });
  await shot('studio-desktop-colors', '#/style/colors', { fullPage: false, before: hideBanner });
  await shot('studio-desktop-fonts', '#/style/fonts', { fullPage: false, before: hideBanner });
  await shot('studio-desktop-layout', '#/style/layout', { fullPage: false, before: hideBanner });
  await shot('studio-desktop-paper', '#/style/paper', { fullPage: false, before: hideBanner });
  await shot('studio-phone-themes', '#/style/themes', { ...phone, before: hideBanner });
  await shot('studio-phone-fonts', '#/style/fonts', { ...phone, before: async (p) => { await hideBanner(p); await p.evaluate(() => window.scrollTo(0, 420)); } });
  await shot('studio-phone-stickers', '#/day/2026-10-10', { ...phone, before: async (p) => { await hideBanner(p); await p.click('[data-act="day-sticker"]'); } });

  // ---------- phase 2: four very different custom looks ----------
  const style = (fn) => async (p) => { await hideBanner(p); await p.evaluate(fn); await p.waitForTimeout(300); };
  // 1) hourly timeline, Ocean Breeze, grid paper, no spiral, modern fonts
  await shot('look1-hourly-ocean-desktop', '#/day/2026-10-08', { before: style(() => window.__planner.store.updateStyle((s) => {
    s.themeId = 'ocean'; s.layout.day = 'hourly'; s.layout.spiral = false; s.layout.hourStart = 7; s.layout.hourEnd = 21;
    s.paper.texture = 'grid'; s.fonts = { heading: 'montserrat', body: 'dmsans', script: 'dancing' };
    s.header.title = 'plan it, babe'; })) });
  await shot('look1-hourly-ocean-phone', '#/day/2026-10-08', { ...phone, before: style(() => window.__planner.store.updateStyle((s) => {
    s.themeId = 'ocean'; s.layout.day = 'hourly'; s.layout.hourStart = 7; s.layout.hourEnd = 21; s.paper.texture = 'grid';
    s.fonts = { heading: 'montserrat', body: 'dmsans', script: 'dancing' }; })) });
  // 2) dot-grid kraft, Terracotta, hand-lettered fonts, weekend spread
  await shot('look2-kraft-dotgrid-desktop', '#/day/2026-10-10', { before: style(() => window.__planner.store.updateStyle((s) => {
    s.themeId = 'terracotta'; s.paper.texture = 'dots'; s.paper.stock = 'kraft';
    s.fonts = { heading: 'amatic', body: 'karla', script: 'homemade' }; s.header.title = 'field notes';
    s.quotes.mode = 'fixed'; s.quotes.fixed = 'Coffee first, then conquer.'; })) });
  await shot('look2-kraft-dotgrid-month', '#/month/2026-10', { before: style(() => window.__planner.store.updateStyle((s) => {
    s.themeId = 'terracotta'; s.paper.texture = 'dots'; s.paper.stock = 'kraft';
    s.fonts = { heading: 'amatic', body: 'karla', script: 'homemade' }; s.header.title = 'field notes'; })) });
  // 3) custom-built dark theme + background photo, side-by-side columns, Monday week start
  const bg = 'data:image/jpeg;base64,' + require('fs').readFileSync(path.join(__dirname, 'assets/sample-background.jpg')).toString('base64');
  const look3 = (bgData) => { localStorage.setItem('jb-planner:bg-image', bgData); window.__planner.store.updateStyle((s) => {
    s.customThemes.push({ id: 'th_velvet', name: 'Velvet Night', custom: true, colors: { accent: '#e2a6c3', secondary: '#9fd3c7', desk: '#1d1724', page: '#2a2233', text: '#f4ecf2', script: '#f2c98a',
      sections: { teal: '#7fc4b8', blush: '#e2a6c3', rose: '#d07a98', sage: '#9fbf8f', lavender: '#b39ddb', butter: '#f2c98a', peach: '#e8a07f', sky: '#87b5e0', stone: '#9a8fa3' } } });
    s.themeId = 'th_velvet'; s.layout.day = 'columns'; s.layout.weekStart = 1; s.paper.hasImage = true; s.paper.imageDim = 0.15;
    s.fonts = { heading: 'playfair', body: 'lora', script: 'greatvibes' }; s.header.title = 'after dark'; }); };
  await shot('look3-custom-velvet-columns-desktop', '#/day/2026-10-10', { before: async (p) => { await hideBanner(p); await p.evaluate(look3, bg); await p.waitForTimeout(400); } });
  await shot('look3-custom-velvet-month-monday', '#/month/2026-10', { before: async (p) => { await hideBanner(p); await p.evaluate(look3, bg); await p.waitForTimeout(400); } });
  // 4) phone: Lavender Haze on linen, lined pages, one-list layout, renamed header + own quote
  await shot('look4-lavender-linen-phone-day', '#/day/2026-10-08', { ...phone, before: style(() => window.__planner.store.updateStyle((s) => {
    s.themeId = 'lavender'; s.paper.stock = 'linen'; s.paper.texture = 'lined'; s.layout.day = 'stacked';
    s.fonts = { heading: 'cinzel', body: 'nunito', script: 'parisienne' }; s.header.title = "Jordan's planner";
    s.quotes.mode = 'fixed'; s.quotes.fixed = 'Tiny humans, big love.'; })) });
  await shot('look4-lavender-linen-phone-myday', '#/myday/2026-10-10', { ...phone, before: style(() => window.__planner.store.updateStyle((s) => {
    s.themeId = 'lavender'; s.paper.stock = 'linen'; s.paper.texture = 'lined';
    s.fonts = { heading: 'cinzel', body: 'nunito', script: 'parisienne' }; s.header.title = "Jordan's planner"; })) });
  await shot('look4-lavender-studio-desktop', '#/style/paper', { fullPage: false, before: style(() => window.__planner.store.updateStyle((s) => {
    s.themeId = 'lavender'; s.paper.stock = 'linen'; s.paper.texture = 'lined'; s.layout.day = 'stacked';
    s.fonts = { heading: 'cinzel', body: 'nunito', script: 'parisienne' }; s.header.title = "Jordan's planner"; })) });

  // interactions: section editor + export panel
  await shot('desktop-section-editor', '#/day/2026-10-10', { fullPage: false, before: async (p) => { await p.click('.section:nth-of-type(4) [data-act="sec-menu"]'); } });
  await shot('desktop-export-panel', '#/day/2026-10-08', { fullPage: false, before: async (p) => { await p.click('.head-actions [data-act="export"]'); } });
  await browser.close();
  if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; } else console.log('no console errors');
})();

# Mom.OS: prototype v0.2

Mom.OS — a calm, customizable, ADHD-friendly daily planner. It's a static PWA (vanilla JS ES modules, no build step) and stores data in `localStorage`.

## Run locally
```bash
cd /workspace/planner-app
python3 -m http.server 8765        # then open http://127.0.0.1:8765/
```
Any static host works (Netlify, Vercel, GitHub Pages, Cloudflare Pages). It needs HTTPS for the service worker and for iPhone "Add to Home Screen" to open full-screen.

## Tests & screenshots
```bash
export NODE_PATH=/workspace/planner-tools/node_modules   # playwright-core, drives /usr/bin/google-chrome
node scripts/smoke-test.cjs          # 19 checks: lines, times, sections, templates, My Day, .ics, sample data
node scripts/smoke-test-studio.cjs   # 31 checks: themes, color builder, fonts, stickers, quotes, layouts, paper, share/reset
node scripts/screenshots.cjs         # writes screenshots/*.png
```

## Structure
```
index.html, manifest.webmanifest, sw.js     PWA shell (offline cache, iOS full-screen meta)
css/styles.css                              4 hand-tuned themes + all components, layouts, textures, studio
fonts/                                      29 bundled OFL web fonts (Latin subsets, .woff)
icons/                                      app icons (192/512/maskable/apple-touch)
js/app.js                                   router (#/month, #/day, #/myday, #/style/<panel>) + render loop
js/store.js                                 state + LocalStorageAdapter (swap for a backend later)
js/templates.js                             default weekday/weekend sections, template <-> day
js/seed.js                                  sample days (Oct 8 & 10, 2026) + clear sample
js/dates.js, util.js, ui.js                 helpers, popovers/bottom sheets, toasts, icons
js/views/month.js, day.js, myday.js         planner views (day has 4 layouts incl. hourly)
js/views/studio.js                          STYLE tab: customization studio + live preview
js/views/export.js                          "Add to Apple Calendar" panel
js/style/engine.js                          applies style: derived CSS vars, fonts, paper, toggles, bg photo, import/export
js/style/presets.js                         13 theme presets, quote library, patterns/stocks, day layouts
js/style/fonts.js                           curated font catalog (9 heading, 9 body, 10 script)
js/style/stickers.js, sticker-picker.js     4 SVG sticker packs (24 stickers) + emoji sheet + picker
js/calendar/events.js                       normalized event model (the seam for every sync target)
js/calendar/ics.js                          RFC 5545 writer, VTIMEZONE America/Chicago, line folding
js/calendar/providers.js                    icsDownload, icsShare (live) + subscriptionFeed, caldav (planned)
scripts/                                    smoke tests, screenshot script, sample background photo
```

## Customization model (`settings.style`)
`themeId`, `customThemes[]` (each theme has accent/secondary/desk/page/text/script + 9 section colors), `fonts{heading,body,script}`,
`header{title,showMark}`, `quotes{mode,fixed,useLibrary,cats,custom}`, `layout{day,spiral,notes,weekStart,hourStart,hourEnd}`,
`paper{texture,stock,desk,hasImage,imageDim}`, `stickers{showInMonth,packs,recent}`. The background photo is stored under its own key
(`jb-planner:bg-image`) so it isn't re-saved on every keystroke. A style file (`type: "jb-planner-style"`) holds all of this and can
optionally include the photo. Stickers are saved on the data itself: `day.stickers[]`, `section.sticker`, `item.sticker`.

// Curated "Looks" — bundles of theme + fonts + chrome + quote display + layout toggles.
// Selecting a Look applies the whole bundle; tweaking afterward becomes lookId: 'custom'.

export const LOOKS = [
  {
    id: 'studio',
    name: 'Studio',
    note: 'Warm neutrals, deep teal, quiet chrome. Premium default.',
    swatch: ['#f3f1ee', '#fbfaf8', '#3d6b6e', '#2c2a28'],
    patch: {
      themeId: 'studio',
      chrome: 'refined',
      fonts: { heading: 'cormorant', body: 'dmsans', script: 'cormorant', brand: 'montserrat' },
      header: { wordmark: 'a', showMark: true },
      quotes: { display: 'italic' },
      layout: { spiral: false },
      stickers: { showInMonth: false },
      paper: { texture: 'plain', stock: 'smooth' },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal Mono',
    note: 'Black ink, bright white, zero fuss.',
    swatch: ['#ececec', '#ffffff', '#2f2f2f', '#222222'],
    patch: {
      themeId: 'mono',
      chrome: 'refined',
      fonts: { heading: 'montserrat', body: 'dmsans', script: 'montserrat', brand: 'montserrat' },
      header: { wordmark: 'a', showMark: true },
      quotes: { display: 'smallcaps' },
      layout: { spiral: false },
      stickers: { showInMonth: false },
      paper: { texture: 'plain', stock: 'smooth' },
    },
  },
  {
    id: 'editorial',
    name: 'Editorial Serif',
    note: 'Cream paper, dusty rose accent, bookish type.',
    swatch: ['#f0ebe4', '#fffaf4', '#a66d6d', '#2f2a28'],
    patch: {
      themeId: 'editorial',
      chrome: 'refined',
      fonts: { heading: 'playfair', body: 'lora', script: 'playfair', brand: 'playfair' },
      header: { wordmark: 'b', showMark: true },
      quotes: { display: 'italic' },
      layout: { spiral: false },
      stickers: { showInMonth: false },
      paper: { texture: 'plain', stock: 'smooth' },
    },
  },
  {
    id: 'sweet',
    name: 'Sweet',
    note: 'The original playful paper-planner look.',
    swatch: ['#f4eeec', '#fefdfb', '#7db3b5', '#ee9fb4'],
    patch: {
      themeId: 'blush',
      chrome: 'playful',
      fonts: { heading: 'auto', body: 'auto', script: 'auto', brand: 'auto' },
      header: { wordmark: 'a', showMark: true },
      quotes: { display: 'script' },
      layout: { spiral: true },
      stickers: { showInMonth: true },
      paper: { texture: 'plain', stock: 'smooth' },
    },
  },
];

export const lookById = (id) => LOOKS.find((l) => l.id === id);

/** Apply a Look bundle onto a style object (mutates and returns it). */
export function applyLook(style, lookId) {
  const look = lookById(lookId);
  if (!look) return style;
  const p = look.patch;
  style.lookId = look.id;
  style.themeId = p.themeId;
  style.chrome = p.chrome;
  style.fonts = { ...style.fonts, ...p.fonts };
  style.header = { ...style.header, ...p.header };
  style.quotes = { ...style.quotes, ...p.quotes };
  style.layout = { ...style.layout, ...p.layout };
  style.stickers = { ...style.stickers, ...p.stickers };
  style.paper = { ...style.paper, ...p.paper };
  return style;
}

/** True when a saved style still matches the pre-Looks shipped default (Blush / Sweet). */
export function isLegacyStockDefault(saved) {
  if (!saved || typeof saved !== 'object') return true;
  if (saved.lookId) return false;
  if (saved.customThemes?.length) return false;
  if (saved.themeId && saved.themeId !== 'blush') return false;
  const f = saved.fonts || {};
  for (const k of ['heading', 'body', 'script', 'brand']) {
    if (f[k] && f[k] !== 'auto') return false;
  }
  if (saved.layout && saved.layout.spiral === false) return false;
  if (saved.stickers && saved.stickers.showInMonth === false) return false;
  if (saved.paper?.texture && saved.paper.texture !== 'plain') return false;
  if (saved.paper?.stock && saved.paper.stock !== 'smooth') return false;
  if (saved.paper?.hasImage) return false;
  if (saved.chrome && saved.chrome !== 'playful') return false;
  const title = (saved.header?.title || '').trim().toLowerCase();
  if (title && !['my planner', 'momos', 'mom.os'].includes(title)) return false;
  return true;
}

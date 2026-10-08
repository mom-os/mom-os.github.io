// Curated, locally bundled font catalog (Latin subsets in /fonts, OFL licensed).
// Browsers only download a face when it's actually used, so the catalog is cheap.
const F = (id, name, file, cat, stack, opts = {}) => ({ id, name, file, cat, stack: `'${name}', ${stack}`, ...opts });

export const FONTS = [
  // headings + labels
  F('josefin', 'Josefin Sans', 'JosefinSans.woff', 'heading', 'system-ui, sans-serif', { weight: '100 700', note: 'Airy, like the paper planner' }),
  F('cormorant', 'Cormorant Garamond', 'CormorantGaramond.woff', 'heading', 'Georgia, serif', { weight: '300 700', note: 'Elegant serif' }),
  F('playfair', 'Playfair Display', 'PlayfairDisplay.woff', 'heading', 'Georgia, serif', { weight: '400 900', note: 'Editorial' }),
  F('dmserif', 'DM Serif Display', 'DMSerifDisplay.woff', 'heading', 'Georgia, serif', { note: 'Bold & classic' }),
  F('montserrat', 'Montserrat', 'Montserrat.woff', 'heading', 'system-ui, sans-serif', { weight: '100 900', note: 'Clean geometric' }),
  F('raleway', 'Raleway', 'Raleway.woff', 'heading', 'system-ui, sans-serif', { weight: '100 900', note: 'Light & stylish' }),
  F('cinzel', 'Cinzel', 'Cinzel.woff', 'heading', 'Georgia, serif', { weight: '400 900', note: 'Luxe capitals' }),
  F('amatic', 'Amatic SC', 'AmaticSC-Bold.woff', 'heading', 'cursive', { weight: '700', note: 'Hand-drawn caps' }),
  F('comfortaa', 'Comfortaa', 'Comfortaa.woff', 'heading', 'system-ui, sans-serif', { weight: '300 700', note: 'Soft & round', both: true }),
  // body
  F('quicksand', 'Quicksand', 'Quicksand.woff', 'body', 'ui-rounded, system-ui, sans-serif', { weight: '300 700', note: 'Rounded & friendly' }),
  F('nunito', 'Nunito', 'Nunito.woff', 'body', 'system-ui, sans-serif', { weight: '200 1000', note: 'Warm & readable' }),
  F('dmsans', 'DM Sans', 'DMSans.woff', 'body', 'system-ui, sans-serif', { weight: '100 1000', note: 'Crisp modern' }),
  F('figtree', 'Figtree', 'Figtree.woff', 'body', 'system-ui, sans-serif', { weight: '300 900', note: 'Simple & clear' }),
  F('karla', 'Karla', 'Karla.woff', 'body', 'system-ui, sans-serif', { weight: '200 800', note: 'Quirky grotesque' }),
  F('lora', 'Lora', 'Lora.woff', 'body', 'Georgia, serif', { weight: '400 700', note: 'Bookish serif' }),
  F('lato', 'Lato', [['Lato-Regular.woff', 400], ['Lato-Bold.woff', 700]], 'body', 'system-ui, sans-serif', { note: 'Neutral classic' }),
  F('poppins', 'Poppins', [['Poppins-Regular.woff', 400], ['Poppins-SemiBold.woff', 600]], 'body', 'system-ui, sans-serif', { note: 'Geometric & bold' }),
  // script / handwriting
  F('sacramento', 'Sacramento', 'Sacramento-Regular.woff', 'script', 'cursive', { note: 'Thin monoline (default)' }),
  F('dancing', 'Dancing Script', 'DancingScript.woff', 'script', 'cursive', { weight: '400 700', note: 'Bouncy' }),
  F('greatvibes', 'Great Vibes', 'GreatVibes.woff', 'script', 'cursive', { note: 'Formal calligraphy' }),
  F('parisienne', 'Parisienne', 'Parisienne.woff', 'script', 'cursive', { note: 'French flair' }),
  F('allura', 'Allura', 'Allura.woff', 'script', 'cursive', { note: 'Romantic' }),
  F('homemade', 'Homemade Apple', 'HomemadeApple.woff', 'script', 'cursive', { note: 'Real handwriting' }),
  F('satisfy', 'Satisfy', 'Satisfy.woff', 'script', 'cursive', { note: 'Retro brush' }),
  F('pacifico', 'Pacifico', 'Pacifico.woff', 'script', 'cursive', { note: 'Chunky & fun' }),
  F('caveat', 'Caveat', 'Caveat.woff', 'script', 'cursive', { weight: '400 700', note: 'Marker notes' }),
  F('shadows', 'Shadows Into Light', 'ShadowsIntoLight.woff', 'script', 'cursive', { note: 'Pencil scribble' }),
];
export const fontById = (id) => FONTS.find((f) => f.id === id);
export const fontsFor = (cat) => FONTS.filter((f) => f.cat === cat || (f.both && cat === 'body'));

const ALREADY_IN_CSS = new Set(['josefin', 'cormorant', 'quicksand', 'sacramento']);
export function injectFontFaces() {
  if (document.getElementById('font-catalog')) return;
  const fontBase = new URL('../../fonts/', import.meta.url).href;
  const css = FONTS.filter((f) => !ALREADY_IN_CSS.has(f.id)).flatMap((f) => {
    const files = Array.isArray(f.file) ? f.file : [[f.file, f.weight || '400']];
    return files.map(([file, w]) => `@font-face{font-family:'${f.name}';src:url('${fontBase}${file}') format('woff');font-weight:${w};font-display:swap;}`);
  }).join('\n');
  const el = Object.assign(document.createElement('style'), { id: 'font-catalog', textContent: css });
  document.head.appendChild(el);
}

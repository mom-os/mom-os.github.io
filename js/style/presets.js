// Theme presets. `css: true` themes are hand-tuned in styles.css; the rest are
// generated from their colors by engine.deriveVars(), exactly like custom themes.
const LIGHT_SECTIONS = { teal: '#7db3b5', blush: '#f2b6c4', rose: '#e48aa3', sage: '#a7c4a3', lavender: '#c2b3dc', butter: '#f0d68a', peach: '#f4bd9c', sky: '#9cc5e2', stone: '#bfb5af' };
const DARK_SECTIONS = { teal: '#70a4a6', blush: '#d59cb2', rose: '#c97a93', sage: '#8fae8e', lavender: '#a796cb', butter: '#d8b67f', peach: '#d49c80', sky: '#80a7c7', stone: '#8c8292' };
const T = (id, name, note, c, extra = {}) => ({ id, name, note, colors: { sections: c.dark ? DARK_SECTIONS : LIGHT_SECTIONS, ...c }, ...extra });

export const PRESETS = [
  T('blush', 'Blush & Teal', 'The paper planner look: soft white pages, teal banner, pink tabs.',
    { accent: '#7db3b5', secondary: '#ee9fb4', desk: '#f4eeec', page: '#fefdfb', text: '#4b4549', script: '#6aa6a9' }, { css: true }),
  T('linen', 'Linen Minimal', 'Quiet neutrals and lots of white space.',
    { accent: '#a39686', secondary: '#cdc4b7', desk: '#eeeae3', page: '#fcfbf7', text: '#3e3b37', script: '#8a7f73',
      sections: { teal: '#8faaa8', blush: '#dcc4bf', rose: '#c69c99', sage: '#a9b39c', lavender: '#b4acbf', butter: '#dacc9f', peach: '#d9b59f', sky: '#a7b8c4', stone: '#b8aea4' } }, { css: true }),
  T('moody', 'Midnight Moody', 'Dark plum pages, mauve and soft gold.',
    { accent: '#c48fa9', secondary: '#d8b67f', desk: '#17151b', page: '#25222b', text: '#eee6ec', script: '#d8b67f', dark: true }, { css: true }),
  T('sage', 'Sage & Peach', 'Garden greens with warm peach tabs.',
    { accent: '#8fae96', secondary: '#e9a78b', desk: '#edf1ea', page: '#fdfcf8', text: '#3f4a42', script: '#d98f70' }, { css: true }),
  T('lavender', 'Lavender Haze', 'Dreamy lilac with candy-pink tabs.',
    { accent: '#a99bd0', secondary: '#f3b6c8', desk: '#f1eef7', page: '#fdfcff', text: '#4a4458', script: '#9a88c9' }),
  T('ocean', 'Ocean Breeze', 'Sea blue with a sunny pop.',
    { accent: '#5fa8c9', secondary: '#f6c27a', desk: '#e9f2f6', page: '#fbfdfe', text: '#2f4653', script: '#4b97b8' }),
  T('terracotta', 'Terracotta Sun', 'Warm clay, sand and honey.',
    { accent: '#c9775a', secondary: '#e9b872', desk: '#f3e9df', page: '#fffaf4', text: '#4d3a31', script: '#b8644a' }),
  T('lemon', 'Lemon Sorbet', 'Sunny yellow and coral. Pure happy.',
    { accent: '#d9ad2c', secondary: '#f19fa0', desk: '#fbf6e3', page: '#fffef8', text: '#4a4535', script: '#c9981c' }),
  T('cotton', 'Cotton Candy', 'Bubblegum pink and sky blue.',
    { accent: '#f08bb5', secondary: '#8fd3e8', desk: '#fdf0f6', page: '#fffcfe', text: '#574a55', script: '#ec7fae' }),
  T('mint', 'Mint Chip', 'Fresh mint with cocoa accents.',
    { accent: '#5cbd9b', secondary: '#9b7563', desk: '#e9f6f0', page: '#fbfffd', text: '#34463f', script: '#47a684' }),
  T('berry', 'Berry Jam', 'Deep raspberry and rosy blush.',
    { accent: '#a8476e', secondary: '#f3a9b6', desk: '#f6eaee', page: '#fffbfc', text: '#4a2f3a', script: '#a8476e' }),
  T('mono', 'Classic Mono', 'Black ink on bright white. Zero fuss.',
    { accent: '#2f2f2f', secondary: '#a6a6a6', desk: '#ececec', page: '#ffffff', text: '#222222', script: '#2f2f2f',
      sections: { teal: '#7d7d7d', blush: '#bdbdbd', rose: '#555555', sage: '#9a9a9a', lavender: '#8a8a8a', butter: '#d0d0d0', peach: '#b0b0b0', sky: '#6a6a6a', stone: '#c4c4c4' } }),
  T('forest', 'Forest Night', 'Deep evergreen with candlelight gold.',
    { accent: '#8fbf9a', secondary: '#e2b77c', desk: '#111915', page: '#1c2520', text: '#e6eee8', script: '#e2b77c', dark: true }),
];

export const QUOTE_LIBRARY = [
  { text: 'Think big. Start small.', cat: 'motivation' },
  { text: "You've got this!", cat: 'motivation' },
  { text: 'Progress, not perfection.', cat: 'motivation' },
  { text: 'Small steps still count.', cat: 'motivation' },
  { text: 'Done is better than perfect.', cat: 'motivation' },
  { text: 'Start where you are.', cat: 'motivation' },
  { text: 'Little by little, a lot.', cat: 'motivation' },
  { text: 'One thing at a time.', cat: 'calm' },
  { text: 'Breathe. Then begin.', cat: 'calm' },
  { text: 'Slow is still moving.', cat: 'calm' },
  { text: 'Rest is productive too.', cat: 'calm' },
  { text: 'Be gentle with yourself.', cat: 'calm' },
  { text: 'This moment is enough.', cat: 'calm' },
  { text: 'Messy house, happy kids.', cat: 'mom' },
  { text: 'Coffee first, then conquer.', cat: 'mom' },
  { text: "You're doing better than you think.", cat: 'mom' },
  { text: 'Tiny humans, big love.', cat: 'mom' },
  { text: 'Unfinished laundry is fine.', cat: 'mom' },
  { text: 'Make it happen.', cat: 'hustle' },
  { text: 'Dream it. Plan it. Do it.', cat: 'hustle' },
  { text: 'Build the life you love.', cat: 'hustle' },
  { text: 'Create something today.', cat: 'hustle' },
  { text: 'Hustle, but make it cute.', cat: 'hustle' },
  { text: 'Your brain is not broken. It is busy.', cat: 'adhd' },
  { text: 'Pick one. Just one.', cat: 'adhd' },
  { text: 'Write it down, let it go.', cat: 'adhd' },
  { text: 'Future you says thanks.', cat: 'adhd' },
  { text: 'Five minutes counts.', cat: 'adhd' },
];
export const QUOTE_CATS = { motivation: 'Motivation', calm: 'Calm', mom: 'Mom life', hustle: 'Hustle', adhd: 'ADHD-brain' };

export const PATTERNS = [{ id: 'plain', name: 'Plain' }, { id: 'lined', name: 'Lined' }, { id: 'dots', name: 'Dot grid' }, { id: 'grid', name: 'Grid' }];
export const STOCKS = [{ id: 'smooth', name: 'Smooth' }, { id: 'linen', name: 'Linen' }, { id: 'kraft', name: 'Kraft' }];
export const DAY_LAYOUTS = [
  { id: 'vertical', name: 'Planner spread', note: 'Sections flow down two pages (the paper look)' },
  { id: 'columns', name: 'Side by side', note: 'Every section is its own column' },
  { id: 'stacked', name: 'One list', note: 'A single calm column, top to bottom' },
  { id: 'hourly', name: 'Hourly', note: 'Timed lines on an hour-by-hour timeline' },
];

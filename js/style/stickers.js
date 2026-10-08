// Built-in sticker packs (tiny inline SVGs, no network) + a curated emoji sheet.
// A sticker value is "p:<id>" for pack art or "e:<emoji>".
import { esc } from '../util.js';

const O = 'stroke="#5b4a52" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;

export const PACKS = {
  sweet: { name: 'Sweet', items: {
    heart: svg(`<path d="M24 40C10 31 6 24 6 17.5 6 12 10.5 8 15.5 8c3.6 0 6.6 2 8.5 5 1.9-3 4.9-5 8.5-5C37.5 8 42 12 42 17.5 42 24 38 31 24 40z" fill="#f4a7bb" ${O}/><path d="M13 15c1-2 3-3 5-3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>`),
    star: svg(`<path d="M24 5l5.6 11.6 12.7 1.7-9.3 8.9 2.3 12.6L24 33.7l-11.3 6.1L15 27.2l-9.3-8.9 12.7-1.7z" fill="#f6d77c" ${O}/><circle cx="19.5" cy="23" r="1.6" fill="#5b4a52"/><circle cx="28.5" cy="23" r="1.6" fill="#5b4a52"/><path d="M21.5 27.5q2.5 2 5 0" fill="none" ${O}/>`),
    flower: svg(`<g fill="#f7c3d0" ${O}><circle cx="24" cy="12" r="7"/><circle cx="35.4" cy="20.3" r="7"/><circle cx="31" cy="33.7" r="7"/><circle cx="17" cy="33.7" r="7"/><circle cx="12.6" cy="20.3" r="7"/></g><circle cx="24" cy="24" r="6" fill="#f6d77c" ${O}/>`),
    rainbow: svg(`<path d="M5 36a19 19 0 0 1 38 0" fill="none" stroke="#f4a7bb" stroke-width="6"/><path d="M11 36a13 13 0 0 1 26 0" fill="none" stroke="#f6d77c" stroke-width="6"/><path d="M17 36a7 7 0 0 1 14 0" fill="none" stroke="#9cc9c4" stroke-width="6"/><g fill="#fff" ${O}><path d="M3 38a5 5 0 0 1 9-3 4 4 0 0 1 4 6H5a3 3 0 0 1-2-3z"/><path d="M32 41a4 4 0 0 1 4-6 5 5 0 0 1 9 3 3 3 0 0 1-2 3z"/></g>`),
    bow: svg(`<path d="M24 24L8 13c-3 3-3 19 0 22zM24 24l16-11c3 3 3 19 0 22z" fill="#f4a7bb" ${O}/><path d="M22 26l-6 14 4-1 2 3 3-13M26 26l6 14-4-1-2 3-3-13" fill="#f4a7bb" ${O}/><rect x="20" y="19.5" width="8" height="9" rx="3" fill="#ee8fa9" ${O}/>`),
    sparkle: svg(`<path d="M20 6l3.5 10.5L34 20l-10.5 3.5L20 34l-3.5-10.5L6 20l10.5-3.5z" fill="#c9b8e6" ${O}/><path d="M36 28l1.8 5.2L43 35l-5.2 1.8L36 42l-1.8-5.2L29 35l5.2-1.8z" fill="#f6d77c" ${O}/>`),
  } },
  mom: { name: 'Mom life', items: {
    coffee: svg(`<path d="M9 18h24v10a10 10 0 0 1-10 10h-4A10 10 0 0 1 9 28z" fill="#f2d3c2" ${O}/><path d="M33 21h3a5 5 0 0 1 0 10h-4" fill="none" ${O}/><path d="M16 8c-2 3 2 4 0 7M23 7c-2 3 2 4 0 7" fill="none" ${O}/><path d="M17 27q4 3 8 0" fill="none" ${O}/><circle cx="16.5" cy="24" r="1.3" fill="#5b4a52"/><circle cx="25.5" cy="24" r="1.3" fill="#5b4a52"/>`),
    bottle: svg(`<path d="M20 5h8v5h-8z" fill="#f4a7bb" ${O}/><path d="M17 12h14v4H17z" fill="#9cc9c4" ${O}/><rect x="15" y="16" width="18" height="26" rx="6" fill="#fff" ${O}/><path d="M15 30h18v6a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z" fill="#fbe7ec"/><path d="M15 24h5M15 30h5M15 36h5" ${O}/>`),
    duck: svg(`<path d="M8 28c0 8 7 12 16 12s17-4 17-11c0-4-3-6-6-5-1-6-6-10-12-10-7 0-11 5-11 10-2-1-4 1-4 4z" fill="#f6d77c" ${O}/><path d="M9 21l-5 2 5 2" fill="#f4bd9c" ${O}/><circle cx="16" cy="18" r="1.6" fill="#5b4a52"/><path d="M24 27q6 4 11 0" fill="none" ${O}/>`),
    balloon: svg(`<ellipse cx="24" cy="18" rx="12" ry="14" fill="#c9b8e6" ${O}/><path d="M22 32h4l-2 3z" fill="#c9b8e6" ${O}/><path d="M24 35c-3 4 3 6 0 10" fill="none" ${O}/><path d="M17 12a7 7 0 0 1 5-4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
    house: svg(`<path d="M7 22L24 8l17 14" fill="none" ${O}/><path d="M11 20v20h26V20L24 10z" fill="#fbe7ec" ${O}/><rect x="20" y="28" width="8" height="12" rx="2" fill="#9cc9c4" ${O}/><path d="M24 22c-3-3-7 0-4 3l4 3 4-3c3-3-1-6-4-3z" fill="#f4a7bb" ${O}/>`),
    moon: svg(`<path d="M30 6a17 17 0 1 0 12 26A14 14 0 0 1 30 6z" fill="#f6d77c" ${O}/><path d="M17 26q2 2 4 0M25 26q2 2 4 0" fill="none" ${O}/><path d="M38 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#c9b8e6" ${O}/>`),
  } },
  hustle: { name: 'Hustle', items: {
    camera: svg(`<rect x="5" y="14" width="38" height="26" rx="6" fill="#f2d3c2" ${O}/><path d="M16 14l3-5h10l3 5" fill="#f2d3c2" ${O}/><circle cx="24" cy="27" r="8" fill="#9cc9c4" ${O}/><circle cx="24" cy="27" r="3.5" fill="#fff" ${O}/><circle cx="36" cy="20" r="1.8" fill="#f4a7bb"/>`),
    hanger: svg(`<path d="M24 16v-2a4 4 0 1 1 4-4" fill="none" ${O}/><path d="M24 16L5 32c-1.5 1.3-.6 4 1.4 4h35.2c2 0 2.9-2.7 1.4-4z" fill="#fbe7ec" ${O}/><path d="M12 32h24" ${O}/>`),
    tag: svg(`<path d="M6 10v13l19 19 17-17L23 6H10a4 4 0 0 0-4 4z" fill="#f6d77c" ${O}/><circle cx="14" cy="14" r="3" fill="#fff" ${O}/><path d="M22 27l8-8M25 31l5-5" ${O}/>`),
    box: svg(`<path d="M6 15l18-8 18 8v19l-18 8-18-8z" fill="#e6c9a3" ${O}/><path d="M6 15l18 8 18-8M24 23v19" fill="none" ${O}/><path d="M15 11l18 8v6" fill="none" ${O}/><path d="M28 31l3 3 6-6" stroke="#5aa38f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
    laptop: svg(`<rect x="9" y="10" width="30" height="20" rx="3" fill="#c7dfe8" ${O}/><path d="M4 34h40l-3 5H7z" fill="#e8dfe3" ${O}/><path d="M18 18q2-2 4 0M26 18q2-2 4 0M20 24q4 3 8 0" fill="none" ${O}/>`),
    money: svg(`<circle cx="24" cy="24" r="17" fill="#bfe0c4" ${O}/><circle cx="24" cy="24" r="12" fill="none" stroke="#5b4a52" stroke-width="1.5" stroke-dasharray="2 3"/><path d="M28 18.5c-1-1.5-3-2-4.5-2-2.5 0-4.5 1.3-4.5 3.5 0 5 9.5 2.5 9.5 7.5 0 2.2-2 3.5-4.8 3.5-2 0-4-1-5-2.5M24 14v3M24 31v3" fill="none" ${O}/>`),
  } },
  seasons: { name: 'Seasons', items: {
    pumpkin: svg(`<path d="M24 12c-4-1-10-1-14 3-5 5-5 15 0 20 4 4 10 4 14 3 4 1 10 1 14-3 5-5 5-15 0-20-4-4-10-4-14-3z" fill="#f4bd9c" ${O}/><path d="M24 12c-4 6-4 20 0 26M24 12c4 6 4 20 0 26" fill="none" ${O}/><path d="M24 12c0-3 1-5 4-7" fill="none" stroke="#7a9e7e" stroke-width="3" stroke-linecap="round"/>`),
    leaf: svg(`<path d="M10 38C8 22 18 9 40 8c1 20-11 32-30 30z" fill="#f2c27a" ${O}/><path d="M10 38L32 16M18 30h8M22 26v-7" fill="none" ${O}/>`),
    snow: svg(`<g ${O} fill="none"><path d="M24 5v38M7.5 14.5l33 19M7.5 33.5l33-19"/><path d="M19 8l5 4 5-4M19 40l5-4 5 4M6 20l6-1 1-6M42 28l-6 1-1 6M6 28l6 1 1 6M42 20l-6-1-1-6"/></g><circle cx="24" cy="24" r="3.5" fill="#c7dfe8" ${O}/>`),
    sun: svg(`<g ${O}><path d="M24 3v6M24 39v6M3 24h6M39 24h6M9 9l4 4M35 35l4 4M9 39l4-4M35 13l4-4"/></g><circle cx="24" cy="24" r="10" fill="#f6d77c" ${O}/><path d="M20 26q4 3 8 0" fill="none" ${O}/><circle cx="20.5" cy="22" r="1.3" fill="#5b4a52"/><circle cx="27.5" cy="22" r="1.3" fill="#5b4a52"/>`),
    cloud: svg(`<path d="M13 36a8 8 0 0 1-1-16 11 11 0 0 1 21-3 9 9 0 0 1 3 19z" fill="#fff" ${O}/><path d="M20 28q3 2 6 0" fill="none" ${O}/><circle cx="19" cy="25" r="1.3" fill="#5b4a52"/><circle cx="27" cy="25" r="1.3" fill="#5b4a52"/><circle cx="16" cy="29" r="1.8" fill="#f7c3d0"/><circle cx="30" cy="29" r="1.8" fill="#f7c3d0"/>`),
    gift: svg(`<rect x="8" y="18" width="32" height="22" rx="3" fill="#9cc9c4" ${O}/><rect x="6" y="13" width="36" height="7" rx="2" fill="#bfe0dc" ${O}/><path d="M24 13v27" stroke="#f4a7bb" stroke-width="5"/><path d="M24 13c-5-8-13-4-8 0zM24 13c5-8 13-4 8 0z" fill="#f4a7bb" ${O}/>`),
  } },
};

export const EMOJI = {
  'Feels': ['😊', '🥰', '😴', '🤯', '😤', '🥳', '😌', '🫶', '💪', '🙏', '✨', '💖'],
  'Home': ['☕', '🍼', '🧸', '🛁', '🧺', '🧹', '🍳', '🥗', '🍕', '🍎', '🛒', '🏡'],
  'Work': ['💻', '🎨', '🖌️', '📸', '📷', '👗', '🏷️', '📦', '💸', '📈', '✉️', '📞'],
  'Nature': ['🌸', '🌷', '🌿', '🍂', '🎃', '🌙', '☀️', '🌈', '❄️', '🌊', '🦋', '🐝'],
  'Marks': ['⭐', '❤️', '✅', '❗', '⏰', '📌', '🎯', '🔥', '💡', '🎉', '🎂', '🚗'],
};

export function stickerHTML(val, cls = '') {
  if (!val) return '';
  if (val.startsWith('e:')) return `<span class="stk emoji ${cls}" aria-hidden="true">${esc(val.slice(2))}</span>`;
  const id = val.slice(2);
  for (const p of Object.values(PACKS)) if (p.items[id]) return `<span class="stk art ${cls}" aria-hidden="true">${p.items[id]}</span>`;
  return '';
}

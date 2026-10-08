// Built-in sticker packs (tiny inline SVGs, no network) + curated emoji.
// A sticker value is "p:<id>" for pack art/emoji or "e:<emoji>".
// Pack item values are either an <svg>… string or a short emoji string.
import { esc } from '../util.js';

const O = 'stroke="#5b4a52" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;

/** Display order in Style → Stickers */
export const PACK_ORDER = [
  'sweet', 'mom', 'hustle', 'seasons',
  'plant', 'witchy', 'sports', 'business', 'sahm', 'newmama',
  'military', 'resale', 'boudoir',
];

export const PACKS = {
  sweet: {
    name: 'Sweet',
    desc: 'Hearts, stars, and sparkles — soft and cheerful.',
    items: {
      heart: svg(`<path d="M24 40C10 31 6 24 6 17.5 6 12 10.5 8 15.5 8c3.6 0 6.6 2 8.5 5 1.9-3 4.9-5 8.5-5C37.5 8 42 12 42 17.5 42 24 38 31 24 40z" fill="#f4a7bb" ${O}/><path d="M13 15c1-2 3-3 5-3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>`),
      star: svg(`<path d="M24 5l5.6 11.6 12.7 1.7-9.3 8.9 2.3 12.6L24 33.7l-11.3 6.1L15 27.2l-9.3-8.9 12.7-1.7z" fill="#f6d77c" ${O}/><circle cx="19.5" cy="23" r="1.6" fill="#5b4a52"/><circle cx="28.5" cy="23" r="1.6" fill="#5b4a52"/><path d="M21.5 27.5q2.5 2 5 0" fill="none" ${O}/>`),
      flower: svg(`<g fill="#f7c3d0" ${O}><circle cx="24" cy="12" r="7"/><circle cx="35.4" cy="20.3" r="7"/><circle cx="31" cy="33.7" r="7"/><circle cx="17" cy="33.7" r="7"/><circle cx="12.6" cy="20.3" r="7"/></g><circle cx="24" cy="24" r="6" fill="#f6d77c" ${O}/>`),
      rainbow: svg(`<path d="M5 36a19 19 0 0 1 38 0" fill="none" stroke="#f4a7bb" stroke-width="6"/><path d="M11 36a13 13 0 0 1 26 0" fill="none" stroke="#f6d77c" stroke-width="6"/><path d="M17 36a7 7 0 0 1 14 0" fill="none" stroke="#9cc9c4" stroke-width="6"/><g fill="#fff" ${O}><path d="M3 38a5 5 0 0 1 9-3 4 4 0 0 1 4 6H5a3 3 0 0 1-2-3z"/><path d="M32 41a4 4 0 0 1 4-6 5 5 0 0 1 9 3 3 3 0 0 1-2 3z"/></g>`),
      bow: svg(`<path d="M24 24L8 13c-3 3-3 19 0 22zM24 24l16-11c3 3 3 19 0 22z" fill="#f4a7bb" ${O}/><path d="M22 26l-6 14 4-1 2 3 3-13M26 26l6 14-4-1-2 3-3-13" fill="#f4a7bb" ${O}/><rect x="20" y="19.5" width="8" height="9" rx="3" fill="#ee8fa9" ${O}/>`),
      sparkle: svg(`<path d="M20 6l3.5 10.5L34 20l-10.5 3.5L20 34l-3.5-10.5L6 20l10.5-3.5z" fill="#c9b8e6" ${O}/><path d="M36 28l1.8 5.2L43 35l-5.2 1.8L36 42l-1.8-5.2L29 35l5.2-1.8z" fill="#f6d77c" ${O}/>`),
    },
  },
  mom: {
    name: 'Mom life',
    desc: 'Everyday mom energy — coffee, bedtime, home.',
    items: {
      coffee: svg(`<path d="M9 18h24v10a10 10 0 0 1-10 10h-4A10 10 0 0 1 9 28z" fill="#f2d3c2" ${O}/><path d="M33 21h3a5 5 0 0 1 0 10h-4" fill="none" ${O}/><path d="M16 8c-2 3 2 4 0 7M23 7c-2 3 2 4 0 7" fill="none" ${O}/><path d="M17 27q4 3 8 0" fill="none" ${O}/><circle cx="16.5" cy="24" r="1.3" fill="#5b4a52"/><circle cx="25.5" cy="24" r="1.3" fill="#5b4a52"/>`),
      bottle: svg(`<path d="M20 5h8v5h-8z" fill="#f4a7bb" ${O}/><path d="M17 12h14v4H17z" fill="#9cc9c4" ${O}/><rect x="15" y="16" width="18" height="26" rx="6" fill="#fff" ${O}/><path d="M15 30h18v6a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z" fill="#fbe7ec"/><path d="M15 24h5M15 30h5M15 36h5" ${O}/>`),
      duck: svg(`<path d="M8 28c0 8 7 12 16 12s17-4 17-11c0-4-3-6-6-5-1-6-6-10-12-10-7 0-11 5-11 10-2-1-4 1-4 4z" fill="#f6d77c" ${O}/><path d="M9 21l-5 2 5 2" fill="#f4bd9c" ${O}/><circle cx="16" cy="18" r="1.6" fill="#5b4a52"/><path d="M24 27q6 4 11 0" fill="none" ${O}/>`),
      balloon: svg(`<ellipse cx="24" cy="18" rx="12" ry="14" fill="#c9b8e6" ${O}/><path d="M22 32h4l-2 3z" fill="#c9b8e6" ${O}/><path d="M24 35c-3 4 3 6 0 10" fill="none" ${O}/><path d="M17 12a7 7 0 0 1 5-4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
      house: svg(`<path d="M7 22L24 8l17 14" fill="none" ${O}/><path d="M11 20v20h26V20L24 10z" fill="#fbe7ec" ${O}/><rect x="20" y="28" width="8" height="12" rx="2" fill="#9cc9c4" ${O}/><path d="M24 22c-3-3-7 0-4 3l4 3 4-3c3-3-1-6-4-3z" fill="#f4a7bb" ${O}/>`),
      moon: svg(`<path d="M30 6a17 17 0 1 0 12 26A14 14 0 0 1 30 6z" fill="#f6d77c" ${O}/><path d="M17 26q2 2 4 0M25 26q2 2 4 0" fill="none" ${O}/><path d="M38 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#c9b8e6" ${O}/>`),
    },
  },
  hustle: {
    name: 'Hustle',
    desc: 'Side-biz basics — camera, listings, laptop.',
    items: {
      camera: svg(`<rect x="5" y="14" width="38" height="26" rx="6" fill="#f2d3c2" ${O}/><path d="M16 14l3-5h10l3 5" fill="#f2d3c2" ${O}/><circle cx="24" cy="27" r="8" fill="#9cc9c4" ${O}/><circle cx="24" cy="27" r="3.5" fill="#fff" ${O}/><circle cx="36" cy="20" r="1.8" fill="#f4a7bb"/>`),
      hanger: svg(`<path d="M24 16v-2a4 4 0 1 1 4-4" fill="none" ${O}/><path d="M24 16L5 32c-1.5 1.3-.6 4 1.4 4h35.2c2 0 2.9-2.7 1.4-4z" fill="#fbe7ec" ${O}/><path d="M12 32h24" ${O}/>`),
      tag: svg(`<path d="M6 10v13l19 19 17-17L23 6H10a4 4 0 0 0-4 4z" fill="#f6d77c" ${O}/><circle cx="14" cy="14" r="3" fill="#fff" ${O}/><path d="M22 27l8-8M25 31l5-5" ${O}/>`),
      box: svg(`<path d="M6 15l18-8 18 8v19l-18 8-18-8z" fill="#e6c9a3" ${O}/><path d="M6 15l18 8 18-8M24 23v19" fill="none" ${O}/><path d="M15 11l18 8v6" fill="none" ${O}/><path d="M28 31l3 3 6-6" stroke="#5aa38f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
      laptop: svg(`<rect x="9" y="10" width="30" height="20" rx="3" fill="#c7dfe8" ${O}/><path d="M4 34h40l-3 5H7z" fill="#e8dfe3" ${O}/><path d="M18 18q2-2 4 0M26 18q2-2 4 0M20 24q4 3 8 0" fill="none" ${O}/>`),
      money: svg(`<circle cx="24" cy="24" r="17" fill="#bfe0c4" ${O}/><circle cx="24" cy="24" r="12" fill="none" stroke="#5b4a52" stroke-width="1.5" stroke-dasharray="2 3"/><path d="M28 18.5c-1-1.5-3-2-4.5-2-2.5 0-4.5 1.3-4.5 3.5 0 5 9.5 2.5 9.5 7.5 0 2.2-2 3.5-4.8 3.5-2 0-4-1-5-2.5M24 14v3M24 31v3" fill="none" ${O}/>`),
    },
  },
  seasons: {
    name: 'Seasons',
    desc: 'Little seasonal marks for the year.',
    items: {
      pumpkin: svg(`<path d="M24 12c-4-1-10-1-14 3-5 5-5 15 0 20 4 4 10 4 14 3 4 1 10 1 14-3 5-5 5-15 0-20-4-4-10-4-14-3z" fill="#f4bd9c" ${O}/><path d="M24 12c-4 6-4 20 0 26M24 12c4 6 4 20 0 26" fill="none" ${O}/><path d="M24 12c0-3 1-5 4-7" fill="none" stroke="#7a9e7e" stroke-width="3" stroke-linecap="round"/>`),
      leaf: svg(`<path d="M10 38C8 22 18 9 40 8c1 20-11 32-30 30z" fill="#f2c27a" ${O}/><path d="M10 38L32 16M18 30h8M22 26v-7" fill="none" ${O}/>`),
      snow: svg(`<g ${O} fill="none"><path d="M24 5v38M7.5 14.5l33 19M7.5 33.5l33-19"/><path d="M19 8l5 4 5-4M19 40l5-4 5 4M6 20l6-1 1-6M42 28l-6 1-1 6M6 28l6 1 1 6M42 20l-6-1-1-6"/></g><circle cx="24" cy="24" r="3.5" fill="#c7dfe8" ${O}/>`),
      sun: svg(`<g ${O}><path d="M24 3v6M24 39v6M3 24h6M39 24h6M9 9l4 4M35 35l4 4M9 39l4-4M35 13l4-4"/></g><circle cx="24" cy="24" r="10" fill="#f6d77c" ${O}/><path d="M20 26q4 3 8 0" fill="none" ${O}/><circle cx="20.5" cy="22" r="1.3" fill="#5b4a52"/><circle cx="27.5" cy="22" r="1.3" fill="#5b4a52"/>`),
      cloud: svg(`<path d="M13 36a8 8 0 0 1-1-16 11 11 0 0 1 21-3 9 9 0 0 1 3 19z" fill="#fff" ${O}/><path d="M20 28q3 2 6 0" fill="none" ${O}/><circle cx="19" cy="25" r="1.3" fill="#5b4a52"/><circle cx="27" cy="25" r="1.3" fill="#5b4a52"/><circle cx="16" cy="29" r="1.8" fill="#f7c3d0"/><circle cx="30" cy="29" r="1.8" fill="#f7c3d0"/>`),
      gift: svg(`<rect x="8" y="18" width="32" height="22" rx="3" fill="#9cc9c4" ${O}/><rect x="6" y="13" width="36" height="7" rx="2" fill="#bfe0dc" ${O}/><path d="M24 13v27" stroke="#f4a7bb" stroke-width="5"/><path d="M24 13c-5-8-13-4-8 0zM24 13c5-8 13-4 8 0z" fill="#f4a7bb" ${O}/>`),
    },
  },

  plant: {
    name: 'Plant mama',
    desc: 'Pots, leaves, herbs, and watered-today energy.',
    items: {
      plantPot: svg(`<path d="M14 22h20l-2 18H16z" fill="#e6c9a3" ${O}/><ellipse cx="24" cy="22" rx="12" ry="4" fill="#c4a484" ${O}/><path d="M24 22c-2-10 6-14 10-10-6 2-8 8-10 10zM24 22c2-10-6-14-10-10 6 2 8 8 10 10z" fill="#7a9e7e" ${O}/><path d="M24 10v12" fill="none" ${O}/>`),
      plantLeaf: svg(`<path d="M10 36C8 18 20 6 40 8c0 18-12 30-30 28z" fill="#9cc9a3" ${O}/><path d="M10 36L30 16M16 28h8M20 24v-6" fill="none" ${O}/>`),
      plantCan: svg(`<path d="M10 18h22v16a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#9cc9c4" ${O}/><path d="M32 22h6l4 4v4l-4 2h-6" fill="#bfe0dc" ${O}/><path d="M16 12c0-3 3-5 6-5s6 2 6 5" fill="none" ${O}/><path d="M40 30c2 2 2 6 0 8M43 28c3 3 3 9 0 12" fill="none" stroke="#7db3d0" stroke-width="1.8" stroke-linecap="round"/>`),
      plantSun: svg(`<circle cx="24" cy="24" r="9" fill="#f6d77c" ${O}/><g ${O} fill="none"><path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5L38 38M10 38l3.5-3.5M34.5 13.5L38 10"/></g>`),
      plantHerb: svg(`<path d="M24 42V18" fill="none" ${O}/><path d="M24 28c-8-2-12-10-10-16 6 2 10 8 10 16zM24 28c8-2 12-10 10-16-6 2-10 8-10 16zM24 20c-6-4-8-12-4-16 4 4 4 12 4 16zM24 20c6-4 8-12 4-16-4 4-4 12-4 16z" fill="#a7c4a3" ${O}/>`),
      plantSprout: svg(`<path d="M24 42V22" fill="none" ${O}/><path d="M24 26c-7-1-11-8-8-14 5 1 8 7 8 14zM24 26c7-1 11-8 8-14-5 1-8 7-8 14z" fill="#bfe0c4" ${O}/><ellipse cx="24" cy="42" rx="10" ry="3" fill="#e6c9a3" ${O}/>`),
      plantWindow: svg(`<rect x="6" y="6" width="36" height="36" rx="3" fill="#eef5f3" ${O}/><path d="M24 6v36M6 24h36" ${O}/><path d="M12 34c2-8 8-12 12-12 4 0 10 4 12 12" fill="#9cc9a3" opacity=".85" ${O}/>`),
      plantMist: svg(`<path d="M18 36c-4-8 2-14 8-10 1-6 8-8 12-2 4 1 6 6 4 10z" fill="#c7dfe8" ${O}/><path d="M12 18c0-2 2-3 3-1M16 12c0-2 2-3 3-1M22 14c0-2 2-3 3-1" fill="none" stroke="#7db3d0" stroke-width="2" stroke-linecap="round"/>`),
      plantClip: svg(`<path d="M14 10l8 8-4 4-8-8a4 4 0 0 1 4-4zM34 10l-8 8 4 4 8-8a4 4 0 0 0-4-4z" fill="#c7dfe8" ${O}/><path d="M18 22l6 14 6-14" fill="none" ${O}/><circle cx="18" cy="14" r="2" fill="#5b4a52"/><circle cx="30" cy="14" r="2" fill="#5b4a52"/>`),
      plantDirt: svg(`<ellipse cx="24" cy="30" rx="16" ry="10" fill="#c4a484" ${O}/><path d="M12 28c2-2 4 0 6-2s4 0 6-2 4 0 6-2 4 2 6 0" fill="none" ${O}/><path d="M20 18c0-4 2-8 4-8s4 4 4 8" fill="#7a9e7e" ${O}/>`),
      plantWatered: '💧',
      plantBloom: '🌸',
      plantFern: '🌿',
      plantSucculent: '🪴',
    },
  },

  witchy: {
    name: 'Witchy mama',
    desc: 'Moon, crystals, candles — soft magic, Studio-calm.',
    items: {
      witchMoon: svg(`<path d="M28 8a16 16 0 1 0 12 24A13 13 0 0 1 28 8z" fill="#e8dff5" ${O}/><path d="M34 12l1.2 2.8L38 16l-2.8 1.2L34 20l-1.2-2.8L30 16l2.8-1.2z" fill="#f6d77c" ${O}/>`),
      witchCrystal: svg(`<path d="M24 6l10 12-10 24L14 18z" fill="#c9b8e6" ${O}/><path d="M24 6v36M14 18h20" fill="none" ${O}/><path d="M24 6l-4 8h8z" fill="#e8dff5" ${O}/>`),
      witchCandle: svg(`<path d="M18 20h12v20a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="#fbe7ec" ${O}/><path d="M22 20v-4M26 20v-4" fill="none" ${O}/><path d="M24 8c-3 4 0 7 0 7s3-3 0-7z" fill="#f6d77c" ${O}/><path d="M16 40h16" ${O}/>`),
      witchTarot: svg(`<rect x="12" y="6" width="24" height="36" rx="3" fill="#f7f2ea" ${O}/><rect x="16" y="10" width="16" height="16" rx="2" fill="#c9b8e6" ${O}/><path d="M24 14v8M20 18h8" ${O}/><path d="M18 32h12M20 36h8" fill="none" ${O}/>`),
      witchStars: svg(`<path d="M14 10l2 5 5 1-4 3.5L18.5 25 14 22l-4.5 3 1.5-5.5L7 16l5-1z" fill="#f6d77c" ${O}/><path d="M34 20l1.5 3.5 3.5.7-2.7 2.5.8 3.8L34 28.5 30.9 30.5l.8-3.8-2.7-2.5 3.5-.7z" fill="#c9b8e6" ${O}/><path d="M26 34l1 2.5 2.5.5-2 1.8.6 2.7L26 40l-2.1 1.5.6-2.7-2-1.8 2.5-.5z" fill="#f4a7bb" ${O}/>`),
      witchHerb: svg(`<path d="M8 40c4-16 16-28 32-30-2 16-14 28-32 30z" fill="#a7c4a3" ${O}/><path d="M8 40L28 18" fill="none" ${O}/><circle cx="34" cy="14" r="2" fill="#c9b8e6"/>`),
      witchCauldron: svg(`<path d="M10 22h28c0 14-6 20-14 20S10 36 10 22z" fill="#5f5569" ${O}/><path d="M8 22h32" ${O}/><path d="M14 18c0-4 3-6 6-4M28 14c2-3 6-2 6 2" fill="none" stroke="#9cc9a3" stroke-width="2"/><path d="M12 40h4M32 40h4" ${O}/>`),
      witchEye: svg(`<ellipse cx="24" cy="24" rx="16" ry="10" fill="#e8dff5" ${O}/><circle cx="24" cy="24" r="6" fill="#5f5569" ${O}/><circle cx="24" cy="24" r="2.5" fill="#f6d77c"/><path d="M8 24c4-3 8-4 16-4s12 1 16 4" fill="none" opacity=".35" ${O}/>`),
      witchMushroom: svg(`<path d="M8 22c0-10 7-16 16-16s16 6 16 16c-5 2-11 3-16 3s-11-1-16-3z" fill="#f4a7bb" ${O}/><path d="M18 25v13a6 6 0 0 0 12 0V25" fill="#f7f2ea" ${O}/><circle cx="16" cy="16" r="2" fill="#fff"/><circle cx="28" cy="14" r="1.5" fill="#fff"/>`),
      witchManifest: '✨',
      witchSalt: '🧂',
      witchOrb: '🔮',
      witchNight: '🌙',
      witchSpark: '💫',
    },
  },

  sports: {
    name: 'Sports mama',
    desc: 'Game day, carpool, cleats, and sideline snacks.',
    items: {
      sportCleat: svg(`<path d="M8 28c8-2 14-8 22-8 6 0 10 4 12 8v6H8z" fill="#5f5569" ${O}/><path d="M10 34h4M18 34h4M26 34h4" ${O}/><path d="M30 20c2-6 8-8 12-4" fill="none" ${O}/>`),
      sportBall: svg(`<circle cx="24" cy="24" r="16" fill="#f2d3c2" ${O}/><path d="M8 24h32M24 8v32M12 12c8 6 16 6 24 0M12 36c8-6 16-6 24 0" fill="none" ${O}/>`),
      sportWhistle: svg(`<path d="M8 22h14l4-6h8a8 8 0 0 1 0 16h-8l-4-6H8a4 4 0 0 1 0-8z" fill="#c7dfe8" ${O}/><circle cx="34" cy="24" r="3" fill="#fff" ${O}/>`),
      sportBottle: svg(`<path d="M20 6h8v6h-8z" fill="#5f5569" ${O}/><rect x="16" y="12" width="16" height="28" rx="5" fill="#9cc9c4" ${O}/><path d="M16 24h16" ${O}/><path d="M22 18h4" stroke="#fff" stroke-width="2"/>`),
      sportCar: svg(`<path d="M6 28l4-10h20l6 10v8H6z" fill="#c7dfe8" ${O}/><path d="M12 18l2-6h12l3 6" fill="#e8dff5" ${O}/><circle cx="14" cy="36" r="4" fill="#5b4a52" ${O}/><circle cx="34" cy="36" r="4" fill="#5b4a52" ${O}/>`),
      sportCone: svg(`<path d="M18 40h12l4-28H14z" fill="#f4bd9c" ${O}/><path d="M12 40h24" ${O}/><path d="M16 28h16" stroke="#fff" stroke-width="3"/>`),
      sportTrophy: svg(`<path d="M14 12h20v8a10 10 0 0 1-20 0z" fill="#f6d77c" ${O}/><path d="M14 16H8a6 6 0 0 0 6 8M34 16h6a6 6 0 0 1-6 8" fill="none" ${O}/><path d="M22 30h4v6h-4z" fill="#e6c9a3" ${O}/><path d="M16 40h16v2H16z" ${O}/>`),
      sportNet: svg(`<path d="M6 10h36v6H6z" fill="#5f5569" ${O}/><path d="M10 16v22M18 16v22M26 16v22M38 16v22M10 24h28M10 32h28" fill="none" ${O}/>`),
      sportHelmet: svg(`<path d="M8 26c0-10 7-18 16-18s16 8 16 18v6H8z" fill="#9cc9c4" ${O}/><path d="M8 28h32" ${O}/><path d="M28 20h8v10H28z" fill="#c7dfe8" ${O}/>`),
      sportGameDay: '🏟️',
      sportRun: '🏃',
      sportSoccer: '⚽',
      sportCheer: '📣',
      sportMedal: '🏅',
    },
  },

  business: {
    name: 'Business mama',
    desc: 'Client calls, coffee, charts — calm hustle.',
    items: {
      bizLaptop: svg(`<rect x="8" y="10" width="32" height="20" rx="2" fill="#d9e3e4" ${O}/><path d="M4 34h40l-4 5H8z" fill="#e8dfe3" ${O}/><path d="M14 18h12M14 22h8" fill="none" ${O}/>`),
      bizCoffee: svg(`<path d="M12 16h20v14a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill="#f2d3c2" ${O}/><path d="M32 20h4a4 4 0 0 1 0 8h-4" fill="none" ${O}/><path d="M18 8c-1 2 1 3 0 5M24 7c-1 2 1 3 0 5" fill="none" ${O}/>`),
      bizBrief: svg(`<rect x="8" y="16" width="32" height="24" rx="3" fill="#e6c9a3" ${O}/><path d="M18 16v-4a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4" fill="none" ${O}/><path d="M8 26h32" ${O}/><circle cx="24" cy="26" r="2" fill="#5b4a52"/>`),
      bizChart: svg(`<path d="M8 40V8M8 40h32" fill="none" ${O}/><path d="M14 32v-8h6v8z" fill="#9cc9c4" ${O}/><path d="M22 32V16h6v16z" fill="#f4a7bb" ${O}/><path d="M30 32v-14h6v14z" fill="#f6d77c" ${O}/>`),
      bizCal: svg(`<rect x="8" y="10" width="32" height="30" rx="3" fill="#fff" ${O}/><path d="M8 18h32" ${O}/><path d="M16 6v8M32 6v8" fill="none" ${O}/><circle cx="18" cy="26" r="2" fill="#f4a7bb"/><circle cx="24" cy="26" r="2" fill="#9cc9c4"/><circle cx="30" cy="32" r="2" fill="#f6d77c"/>`),
      bizPhone: svg(`<rect x="14" y="4" width="20" height="40" rx="4" fill="#d9e3e4" ${O}/><circle cx="24" cy="38" r="2" fill="#5b4a52"/><path d="M18 12h12" ${O}/>`),
      bizPen: svg(`<path d="M30 6l12 12-22 22H8V28z" fill="#c7dfe8" ${O}/><path d="M30 6l4 4M8 28l12 12" fill="none" ${O}/><path d="M20 36l8-8" stroke="#f4a7bb" stroke-width="2"/>`),
      bizCheck: svg(`<rect x="8" y="8" width="32" height="32" rx="4" fill="#eef5f3" ${O}/><path d="M14 24l7 7 14-16" fill="none" stroke="#5aa38f" stroke-width="3" stroke-linecap="round"/>`),
      bizClock: svg(`<circle cx="24" cy="24" r="16" fill="#fff" ${O}/><path d="M24 12v12l8 4" fill="none" ${O}/>`),
      bizClient: '📞',
      bizMail: '📧',
      bizTarget: '🎯',
      bizRocket: '🚀',
      bizIdea: '💡',
    },
  },

  sahm: {
    name: 'Stay-at-home mama',
    desc: 'Laundry, snacks, park days, and resets.',
    items: {
      sahmLaundry: svg(`<rect x="10" y="6" width="28" height="36" rx="4" fill="#c7dfe8" ${O}/><circle cx="24" cy="26" r="10" fill="#eef5f3" ${O}/><circle cx="24" cy="26" r="5" fill="none" ${O}/><path d="M16 12h16" ${O}/>`),
      sahmDishes: svg(`<ellipse cx="24" cy="28" rx="16" ry="8" fill="#e8dff5" ${O}/><ellipse cx="24" cy="24" rx="12" ry="5" fill="#fff" ${O}/><path d="M14 24c2 4 18 4 20 0" fill="none" ${O}/>`),
      sahmCuddle: svg(`<path d="M12 28c0-8 6-12 12-8 6-4 12 0 12 8 0 8-6 14-12 14S12 36 12 28z" fill="#f7c3d0" ${O}/><circle cx="18" cy="22" r="1.4" fill="#5b4a52"/><circle cx="28" cy="22" r="1.4" fill="#5b4a52"/><path d="M20 28q4 3 8 0" fill="none" ${O}/>`),
      sahmPark: svg(`<path d="M8 36c4-14 10-22 16-22s12 8 16 22" fill="#a7c4a3" ${O}/><path d="M24 14v22" fill="none" ${O}/><path d="M6 38h36" ${O}/><circle cx="36" cy="12" r="5" fill="#f6d77c" ${O}/>`),
      sahmSnack: svg(`<rect x="10" y="14" width="28" height="22" rx="4" fill="#f6d77c" ${O}/><path d="M10 22h28" ${O}/><circle cx="20" cy="30" r="2" fill="#f4a7bb"/><circle cx="28" cy="28" r="2" fill="#9cc9c4"/>`),
      sahmBroom: svg(`<path d="M22 4l4 28" fill="none" ${O}/><path d="M14 34c4 6 16 6 20 0l-4-4H18z" fill="#e6c9a3" ${O}/>`),
      sahmBasket: svg(`<path d="M10 18h28l-3 20H13z" fill="#e6c9a3" ${O}/><path d="M16 18c0-6 4-10 8-10s8 4 8 10" fill="none" ${O}/><path d="M14 26h20" ${O}/>`),
      sahmKeys: svg(`<circle cx="16" cy="20" r="8" fill="#f6d77c" ${O}/><circle cx="16" cy="20" r="3" fill="#fff" ${O}/><path d="M22 24l16 8v4l-4-1-2 3-3-3-3 2z" fill="#c7dfe8" ${O}/>`),
      sahmTv: svg(`<rect x="6" y="10" width="36" height="24" rx="3" fill="#d9e3e4" ${O}/><path d="M18 40h12M24 34v6" fill="none" ${O}/><path d="M14 18h12M14 22h8" fill="none" ${O}/>`),
      sahmReset: '🔄',
      sahmHug: '🤗',
      sahmTea: '🫖',
      sahmSocks: '🧦',
      sahmHome: '🏡',
    },
  },

  newmama: {
    name: 'New mama',
    desc: 'Bottles, snuggles, pumping, nap when they nap.',
    items: {
      newBottle: svg(`<path d="M20 4h8v6h-8z" fill="#f4a7bb" ${O}/><path d="M17 10h14v4H17z" fill="#9cc9c4" ${O}/><rect x="15" y="14" width="18" height="28" rx="6" fill="#fff" ${O}/><path d="M15 28h18v8a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z" fill="#fbe7ec"/>`),
      newOnesie: svg(`<path d="M16 8h16l4 8v8h-6v14h-4l-2-6-2 6h-4V24H12V16z" fill="#c7dfe8" ${O}/><circle cx="20" cy="20" r="1.5" fill="#5b4a52"/><circle cx="28" cy="20" r="1.5" fill="#5b4a52"/>`),
      newSleep: svg(`<path d="M8 30c0-10 8-16 16-14 2-6 10-8 14-2 6 1 10 8 8 14z" fill="#e8dff5" ${O}/><path d="M18 26q3 2 6 0" fill="none" ${O}/><path d="M32 12l2 2M36 10l3 3" fill="none" ${O}/>`),
      newPump: svg(`<path d="M16 8h16v8H16z" fill="#c9b8e6" ${O}/><path d="M18 16h12v20a6 6 0 0 1-12 0z" fill="#fbe7ec" ${O}/><path d="M14 28h4M30 28h4" fill="none" ${O}/><circle cx="24" cy="26" r="4" fill="#fff" ${O}/>`),
      newSnuggle: svg(`<ellipse cx="24" cy="26" rx="14" ry="12" fill="#f7c3d0" ${O}/><circle cx="18" cy="22" r="2" fill="#5b4a52"/><circle cx="28" cy="22" r="2" fill="#5b4a52"/><path d="M20 28q4 3 8 0" fill="none" ${O}/><path d="M10 18c2-6 8-8 12-4" fill="none" ${O}/>`),
      newPacifier: svg(`<circle cx="24" cy="22" r="8" fill="#c9b8e6" ${O}/><circle cx="24" cy="22" r="3" fill="#fff" ${O}/><path d="M16 28c0 6 4 10 8 10s8-4 8-10" fill="#fbe7ec" ${O}/>`),
      newMoonSleep: svg(`<path d="M30 8a15 15 0 1 0 10 22A12 12 0 0 1 30 8z" fill="#f6d77c" ${O}/><path d="M12 14h4M14 12v4M34 32h3M35.5 30.5v3" fill="none" ${O}/>`),
      newRattle: svg(`<circle cx="18" cy="18" r="10" fill="#f4a7bb" ${O}/><path d="M25 25l14 14" fill="none" ${O}/><circle cx="40" cy="40" r="3" fill="#f6d77c" ${O}/><circle cx="15" cy="15" r="2" fill="#fff"/>`),
      newHeartTiny: svg(`<path d="M24 36C14 30 10 24 10 19c0-4 3-7 7-7 2.5 0 5 1.5 7 4 2-2.5 4.5-4 7-4 4 0 7 3 7 7 0 5-4 11-14 17z" fill="#f4a7bb" ${O}/>`),
      newNap: '😴',
      newBaby: '👶',
      newMilk: '🥛',
      newBlanket: '🛏️',
      newStars: '🌟',
    },
  },

  military: {
    name: 'Military mama',
    desc: 'PCS, deployment hearts, homecoming — quiet strength.',
    items: {
      milHeart: svg(`<path d="M24 40C10 31 6 24 6 17.5 6 12 10.5 8 15.5 8c3.6 0 6.6 2 8.5 5 1.9-3 4.9-5 8.5-5C37.5 8 42 12 42 17.5 42 24 38 31 24 40z" fill="#6b7a5a" ${O}/><path d="M12 18h6M18 14v8M28 20h8M30 16v8" stroke="#c5d0b8" stroke-width="1.5"/>`),
      milStar: svg(`<path d="M24 6l4.5 9.5 10.5 1.4-7.7 7.3 1.9 10.4L24 29.2l-9.2 5.4 1.9-10.4-7.7-7.3 10.5-1.4z" fill="#c5d0b8" ${O}/>`),
      milTag: svg(`<ellipse cx="24" cy="24" rx="16" ry="12" fill="#c5d0b8" ${O}/><path d="M14 20h20M14 26h14M14 32h10" fill="none" ${O}/><circle cx="10" cy="18" r="2" fill="none" ${O}/>`),
      milBoot: svg(`<path d="M10 16h14v14h10l4 10H10z" fill="#5f5569" ${O}/><path d="M10 36h28" ${O}/><path d="M24 16v8" fill="none" ${O}/>`),
      milPlane: svg(`<path d="M6 26h20l14-10 2 4-10 8 10 6-2 3-14-8H6z" fill="#9aa89a" ${O}/><path d="M18 26v8l4-2" fill="none" ${O}/>`),
      milHome: svg(`<path d="M8 24L24 10l16 14" fill="none" ${O}/><path d="M12 22v18h24V22L24 12z" fill="#c5d0b8" ${O}/><path d="M24 18l-3 3 3 3 3-3z" fill="#6b7a5a" ${O}/>`),
      milFlag: svg(`<path d="M12 6v36" fill="none" ${O}/><path d="M12 8h24l-4 8 4 8H12z" fill="#6b7a5a" ${O}/>`),
      milLetter: svg(`<rect x="6" y="12" width="36" height="24" rx="2" fill="#f7f2ea" ${O}/><path d="M6 12l18 14L42 12" fill="none" ${O}/>`),
      milAnchor: svg(`<path d="M24 8v28M16 20h16" fill="none" ${O}/><circle cx="24" cy="10" r="4" fill="none" ${O}/><path d="M12 36c4 4 8 6 12 6s8-2 12-6" fill="none" ${O}/>`),
      milPcs: '📦',
      milHomecoming: '🏠',
      milPray: '🙏',
      milStrong: '💪',
      milLove: '💙',
    },
  },

  resale: {
    name: 'Resale mama',
    desc: 'Price tags, thrift finds, boxes, listing photos.',
    items: {
      resaleTag: svg(`<path d="M6 12v12l18 18 16-16L22 8H10a4 4 0 0 0-4 4z" fill="#f6d77c" ${O}/><circle cx="14" cy="16" r="3" fill="#fff" ${O}/><path d="M22 28l8-8" ${O}/>`),
      resaleHanger: svg(`<path d="M24 14v-2a3 3 0 1 1 3-3" fill="none" ${O}/><path d="M24 14L8 28c-1 1-.4 3 1.2 3h29.6c1.6 0 2.2-2 1.2-3z" fill="#fbe7ec" ${O}/>`),
      resaleBox: svg(`<path d="M6 16l18-8 18 8v18l-18 8-18-8z" fill="#e6c9a3" ${O}/><path d="M6 16l18 8 18-8M24 24v18" fill="none" ${O}/><path d="M28 30l3 3 6-6" stroke="#5aa38f" stroke-width="2.5" fill="none"/>`),
      resaleCam: svg(`<rect x="6" y="14" width="36" height="24" rx="5" fill="#f2d3c2" ${O}/><path d="M16 14l2-5h12l2 5" fill="#f2d3c2" ${O}/><circle cx="24" cy="26" r="7" fill="#9cc9c4" ${O}/><circle cx="24" cy="26" r="3" fill="#fff" ${O}/>`),
      resaleRack: svg(`<path d="M8 12h32M10 12v28M38 12v28M14 20h20M14 28h20" fill="none" ${O}/><path d="M16 20c2 4 6 4 8 0M24 28c2 4 6 4 8 0" fill="#f4a7bb" ${O}/>`),
      resaleReceipt: svg(`<path d="M14 6h20v36l-3-2-3 2-3-2-3 2-3-2-3 2-3-2z" fill="#fff" ${O}/><path d="M18 14h12M18 20h12M18 26h8" fill="none" ${O}/>`),
      resaleBag: svg(`<rect x="12" y="8" width="24" height="16" rx="2" fill="#e6c9a3" ${O}/><path d="M12 24h24l4 14H8z" fill="#c4a484" ${O}/><path d="M20 12h8" ${O}/>`),
      resaleSpark: svg(`<path d="M24 6l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#f6d77c" ${O}/><path d="M36 28l1.5 4.5L42 34l-4.5 1.5L36 40l-1.5-4.5L30 34l4.5-1.5z" fill="#f4a7bb" ${O}/>`),
      resaleSold: svg(`<circle cx="24" cy="24" r="16" fill="#bfe0c4" ${O}/><path d="M14 24h20M18 18l12 12M30 18L18 30" fill="none" stroke="#5aa38f" stroke-width="2.5"/>`),
      resaleThrift: '🛍️',
      resaleCash: '💵',
      resaleShip: '📬',
      resaleStar: '⭐',
      resaleFire: '🔥',
    },
  },

  boudoir: {
    name: 'Boudoir / creative',
    desc: 'Soft light, camera, roses, gallery days.',
    items: {
      bouCam: svg(`<rect x="5" y="14" width="38" height="26" rx="6" fill="#e8dfe3" ${O}/><path d="M16 14l3-5h10l3 5" fill="#e8dfe3" ${O}/><circle cx="24" cy="27" r="8" fill="#c9b8e6" ${O}/><circle cx="24" cy="27" r="3.5" fill="#fff" ${O}/>`),
      bouRose: svg(`<path d="M24 40c-2-8-10-12-10-20 0-6 4-10 10-10s10 4 10 10c0 8-8 12-10 20z" fill="#f4a7bb" ${O}/><path d="M24 20c-4 0-6 3-4 6 2 0 4-2 4-6 0 4 2 6 4 6 2-3 0-6-4-6z" fill="#ee8fa9" ${O}/><path d="M24 40c-4 0-6 2-8 4M24 40c4 0 6 2 8 4" fill="none" stroke="#7a9e7e" stroke-width="2"/>`),
      bouLight: svg(`<path d="M18 8h12l4 14H14z" fill="#f6d77c" ${O}/><path d="M20 22v6h8v-6" fill="#e6c9a3" ${O}/><path d="M16 36h16" ${O}/><path d="M24 4v2M10 14l2 2M36 14l-2 2" fill="none" ${O}/>`),
      bouFrame: svg(`<rect x="8" y="8" width="32" height="32" rx="2" fill="#f7f2ea" ${O}/><rect x="12" y="12" width="24" height="20" fill="#e8dff5" ${O}/><path d="M12 32l8-8 6 6 4-4 6 6" fill="#c9b8e6" ${O}/>`),
      bouLip: svg(`<path d="M10 22c4-6 10-6 14-2 4-4 10-4 14 2 2 4-2 10-14 14C12 32 8 26 10 22z" fill="#e48aa3" ${O}/><path d="M12 24c8 2 16 2 24 0" fill="none" stroke="#fff" stroke-width="1.5"/>`),
      bouPerfume: svg(`<path d="M20 6h8v6h-8z" fill="#c9b8e6" ${O}/><path d="M16 12h16v4H16z" fill="#e8dff5" ${O}/><path d="M18 16h12v24a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="#fbe7ec" ${O}/>`),
      bouHeartSoft: svg(`<path d="M24 38C12 30 8 24 8 18.5 8 14 11.5 10 16 10c3 0 5.5 1.5 8 4 2.5-2.5 5-4 8-4 4.5 0 8 4 8 8.5C40 24 36 30 24 38z" fill="#f7c3d0" ${O}/>`),
      bouCurtain: svg(`<path d="M6 6h36v4H6z" fill="#c9b8e6" ${O}/><path d="M10 10c2 10 0 20 2 30M18 10c-1 10 2 20 0 30M30 10c2 10-1 20 1 30M38 10c-2 10 0 20-2 30" fill="none" ${O}/>`),
      bouLens: svg(`<circle cx="24" cy="24" r="16" fill="#d9e3e4" ${O}/><circle cx="24" cy="24" r="10" fill="#c9b8e6" ${O}/><circle cx="24" cy="24" r="4" fill="#fff" ${O}/>`),
      bouGallery: '🖼️',
      bouSparkle: '✨',
      bouChampagne: '🥂',
      bouFlower: '🥀',
      bouLove: '💕',
    },
  },
};

export const EMOJI = {
  'Feels': ['😊', '🥰', '😴', '🤯', '😤', '🥳', '😌', '🫶', '💪', '🙏', '✨', '💖'],
  'Home': ['☕', '🍼', '🧸', '🛁', '🧺', '🧹', '🍳', '🥗', '🍕', '🍎', '🛒', '🏡'],
  'Work': ['💻', '🎨', '🖌️', '📸', '📷', '👗', '🏷️', '📦', '💸', '📈', '✉️', '📞'],
  'Nature': ['🌸', '🌷', '🌿', '🍂', '🎃', '🌙', '☀️', '🌈', '❄️', '🌊', '🦋', '🐝'],
  'Marks': ['⭐', '❤️', '✅', '❗', '⏰', '📌', '🎯', '🔥', '💡', '🎉', '🎂', '🚗'],
};

export function orderedPacks() {
  const keys = PACK_ORDER.filter((k) => PACKS[k]);
  for (const k of Object.keys(PACKS)) if (!keys.includes(k)) keys.push(k);
  return keys.map((id) => [id, PACKS[id]]);
}

export function stickerHTML(val, cls = '') {
  if (!val) return '';
  if (val.startsWith('e:')) return `<span class="stk emoji ${cls}" aria-hidden="true">${esc(val.slice(2))}</span>`;
  const id = val.startsWith('p:') ? val.slice(2) : val;
  for (const p of Object.values(PACKS)) {
    const art = p.items[id];
    if (art == null) continue;
    if (typeof art === 'string' && art.startsWith('<svg')) {
      return `<span class="stk art ${cls}" aria-hidden="true">${art}</span>`;
    }
    const em = typeof art === 'string' ? art : art.emoji;
    if (em) return `<span class="stk emoji ${cls}" aria-hidden="true">${esc(em)}</span>`;
  }
  return '';
}

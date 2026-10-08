import { quotePool } from '../style/engine.js';

/** Quote for a day (YYYY-MM-DD) or month spread (YYYY-MM), per the user's quote settings. */
export function quoteFor(ctx, seedKey) {
  const q = ctx.store.style.quotes;
  if (q.mode === 'fixed' && q.fixed.trim()) return q.fixed.trim();
  const pool = quotePool(ctx.store.style);
  if (/^\d{4}-\d{2}$/.test(seedKey)) return pool[0]; // month spread keeps the signature quote, like the paper planner
  let h = 0; for (const ch of seedKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

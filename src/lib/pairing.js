// Pure pairing logic: table layouts, shuffling and session-aware optimization.
// No React / Firebase imports so it can be tested with `node --test`.

export const MIN_TABLE_SIZE = 3;
export const MAX_TABLE_SIZE = 6;

// --- Table Configurations (3-20 players) ---
export const TABLE_CONFIGS = {
  3: [[3]],
  4: [[4]],
  5: [[5]],
  6: [[3, 3], [6]],
  7: [[4, 3]],
  8: [[4, 4]],
  9: [[3, 3, 3], [5, 4]],
  10: [[4, 3, 3], [5, 5]],
  11: [[4, 4, 3]],
  12: [[4, 4, 4], [3, 3, 3, 3], [6, 6]],
  13: [[4, 3, 3, 3], [5, 4, 4]],
  14: [[4, 4, 3, 3], [5, 5, 4]],
  15: [[4, 4, 4, 3], [5, 5, 5], [3, 3, 3, 3, 3]],
  16: [[4, 4, 4, 4]],
  17: [[4, 4, 4, 5], [4, 4, 3, 3, 3]],
  18: [[4, 4, 4, 3, 3], [5, 5, 4, 4], [3, 3, 3, 3, 3, 3]],
  19: [[4, 4, 4, 4, 3], [5, 5, 5, 4]],
  20: [[4, 4, 4, 4, 4], [5, 5, 5, 5]],
};

function fallbackLayouts(count) {
  const numTables = Math.ceil(count / 4);
  const baseSize = Math.floor(count / numTables);
  let remainder = count % numTables;
  const layout = [];
  for (let i = 0; i < numTables; i++) {
    layout.push(baseSize + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return [layout];
}

/** Candidate layouts for `count` players. Empty when a table can't be formed. */
export function getLayouts(count) {
  if (count < MIN_TABLE_SIZE) return [];
  return TABLE_CONFIGS[count] || fallbackLayouts(count);
}

/** Unbiased in-place-free Fisher-Yates shuffle. */
export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function forEachPair(table, fn) {
  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) fn(table[i], table[j]);
  }
}

/**
 * Builds pair history for the current session.
 * `rolls` is newest-first; each roll is `{ tables: [{ players: [{ id }] }] }`.
 * Returns how many times each pair has shared a table, plus the pairs
 * from the most recent roll (repeating those is the most annoying).
 */
export function buildPairHistory(rolls) {
  const counts = new Map();
  const last = new Set();
  rolls.forEach((roll, index) => {
    roll.tables.forEach((table) => {
      forEachPair(table.players, (a, b) => {
        const key = pairKey(a.id, b.id);
        counts.set(key, (counts.get(key) || 0) + 1);
        if (index === 0) last.add(key);
      });
    });
  });
  return { counts, last };
}

const RECENCY_PENALTY = 0.5;

/**
 * Cost of a set of tables (arrays of players): sum of squared pair counts,
 * so a third repeat hurts more than a first, plus a small penalty for
 * repeating a pair from the immediately previous roll.
 */
export function scoreTables(tables, history) {
  let cost = 0;
  tables.forEach((table) => {
    forEachPair(table, (a, b) => {
      const key = pairKey(a.id, b.id);
      const n = history.counts.get(key) || 0;
      cost += n * n;
      if (history.last.has(key)) cost += RECENCY_PENALTY;
    });
  });
  return cost;
}

function chunk(players, layout) {
  const tables = [];
  let start = 0;
  for (const size of layout) {
    tables.push(players.slice(start, start + size));
    start += size;
  }
  return tables;
}

function localSearch(tables, history) {
  let cost = scoreTables(tables, history);
  let improved = true;
  while (improved && cost > 0) {
    improved = false;
    for (let t1 = 0; t1 < tables.length && !improved; t1++) {
      for (let t2 = t1 + 1; t2 < tables.length && !improved; t2++) {
        for (let i = 0; i < tables[t1].length && !improved; i++) {
          for (let j = 0; j < tables[t2].length && !improved; j++) {
            const a = tables[t1][i];
            const b = tables[t2][j];
            tables[t1][i] = b;
            tables[t2][j] = a;
            const next = scoreTables(tables, history);
            if (next < cost) {
              cost = next;
              improved = true;
            } else {
              tables[t1][i] = a;
              tables[t2][j] = b;
            }
          }
        }
      }
    }
  }
  return cost;
}

/**
 * Seats `players` into `layout` (e.g. [4, 4, 3]) minimizing repeat pairings.
 * Random restarts + swap hill-climbing; ties resolve randomly through the
 * random starting points. Returns `{ tables, cost }`.
 */
export function optimizeTables(players, layout, history, { restarts = 30, rng = Math.random } = {}) {
  let best = null;
  for (let r = 0; r < restarts; r++) {
    const tables = chunk(shuffle(players, rng), layout);
    const cost = localSearch(tables, history);
    if (!best || cost < best.cost) best = { tables, cost };
    if (best.cost === 0) break;
  }
  return best;
}

/**
 * Ids of players in `roll`'s randomized tables who sit at a different table
 * number than in `prevRoll`. Players who weren't in `prevRoll` are not flagged.
 * Table numbers are physical tables, so this also works across manual rounds
 * and attendance changes.
 */
export function getMovedIds(roll, prevRoll) {
  const moved = new Set();
  if (!prevRoll) return moved;
  const prevIndex = new Map();
  prevRoll.tables.forEach((table, i) => table.players.forEach((p) => prevIndex.set(p.id, i)));
  roll.tables.forEach((table, i) => {
    if (table.manual) return;
    table.players.forEach((p) => {
      if (prevIndex.has(p.id) && prevIndex.get(p.id) !== i) moved.add(p.id);
    });
  });
  return moved;
}

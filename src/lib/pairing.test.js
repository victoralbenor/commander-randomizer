import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLayouts,
  shuffle,
  buildPairHistory,
  scoreTables,
  optimizeTables,
  getMovedIds,
  pairKey,
} from './pairing.js';

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
const roll = (...tables) => ({ tables: tables.map((players) => ({ players, manual: false })) });

test('getLayouts: empty below 3, known configs, fallback above 20', () => {
  assert.deepEqual(getLayouts(2), []);
  assert.deepEqual(getLayouts(7), [[4, 3]]);
  const big = getLayouts(23)[0];
  assert.equal(big.reduce((a, b) => a + b, 0), 23);
});

test('shuffle keeps every element and does not mutate the input', () => {
  const input = mk(10);
  const copy = [...input];
  const out = shuffle(input);
  assert.deepEqual(input, copy);
  assert.deepEqual([...out].sort((a, b) => a.id.localeCompare(b.id)), [...input].sort((a, b) => a.id.localeCompare(b.id)));
});

test('buildPairHistory counts pairs across rolls and marks the latest roll', () => {
  const p = mk(8);
  const newest = roll(p.slice(0, 4), p.slice(4));
  const older = roll([p[0], p[1], p[4], p[5]], [p[2], p[3], p[6], p[7]]);
  const { counts, last } = buildPairHistory([newest, older]);
  assert.equal(counts.get(pairKey('p1', 'p2')), 2);
  assert.equal(counts.get(pairKey('p1', 'p3')), 1);
  assert.equal(counts.get(pairKey('p1', 'p5')), 1);
  assert.ok(last.has(pairKey('p1', 'p2')));
  assert.ok(!last.has(pairKey('p1', 'p5')));
});

test('optimizeTables finds a zero-repeat seating when one exists (9 players, 2 rounds)', () => {
  // 9 players in 3x3: rounds 1-2 leave a perfect round 3 (affine plane of order 3).
  const p = mk(9);
  const at = (...n) => n.map((i) => p[i - 1]);
  const history = buildPairHistory([
    roll(at(1, 4, 7), at(2, 5, 8), at(3, 6, 9)),
    roll(at(1, 2, 3), at(4, 5, 6), at(7, 8, 9)),
  ]);
  for (let i = 0; i < 50; i++) {
    const { tables, cost } = optimizeTables(p, [3, 3, 3], history);
    assert.equal(cost, 0, JSON.stringify(tables.map((t) => t.map((x) => x.id))));
  }
});

test('optimizeTables respects the layout and uses every player once', () => {
  const p = mk(11);
  const { tables } = optimizeTables(p, [4, 4, 3], buildPairHistory([]));
  assert.deepEqual(tables.map((t) => t.length), [4, 4, 3]);
  assert.equal(new Set(tables.flat().map((x) => x.id)).size, 11);
});

test('scoreTables penalizes a third repeat more than a first', () => {
  const p = mk(4);
  const twice = buildPairHistory([roll(p), roll(p)]).counts;
  const once = buildPairHistory([roll(p)]).counts;
  const table = [p];
  assert.ok(scoreTables(table, { counts: twice, last: new Set() }) > 2 * scoreTables(table, { counts: once, last: new Set() }) - 1);
});

test('a saved manual round counts as played: the next randomize avoids its pairings', () => {
  // 9 players, tables started by hand as people arrived: [1 2 3] [4 5 6] [7 8 9].
  const p = mk(9);
  const at = (...n) => n.map((i) => p[i - 1]);
  const manualRound = {
    tables: [at(1, 2, 3), at(4, 5, 6), at(7, 8, 9)].map((players) => ({ players, manual: true })),
  };
  const history = buildPairHistory([manualRound]);
  for (let i = 0; i < 50; i++) {
    const { tables, cost } = optimizeTables(p, [3, 3, 3], history);
    assert.equal(cost, 0);
    tables.forEach((t) =>
      t.forEach((a, j) =>
        t.slice(j + 1).forEach((b) => {
          assert.ok(!history.counts.has(pairKey(a.id, b.id)), `${a.id} and ${b.id} repeated`);
        })
      )
    );
  }
});

test('getMovedIds flags players whose table number changed since the previous roll', () => {
  const p = mk(8);
  const at = (...n) => n.map((i) => p[i - 1]);
  const prev = roll(at(1, 2, 3, 4), at(5, 6, 7, 8));
  const next = roll(at(1, 2, 5, 6), at(3, 4, 7, 8));
  assert.deepEqual([...getMovedIds(next, prev)].sort(), ['p3', 'p4', 'p5', 'p6']);
  assert.equal(getMovedIds(next, undefined).size, 0);
});

test('getMovedIds works right after a manual round and with attendance changes', () => {
  const p = mk(9);
  const at = (...n) => n.map((i) => p[i - 1]);
  // Manual round started as people arrived; player 9 arrived later and wasn't in it.
  const manual = {
    tables: [at(1, 2, 3, 4), at(5, 6, 7, 8)].map((players) => ({ players, manual: true })),
  };
  const next = roll(at(1, 2, 3, 9), at(4, 5, 6, 7, 8));
  const moved = getMovedIds(next, manual);
  assert.deepEqual([...moved].sort(), ['p4']);
  assert.ok(!moved.has('p9'), 'players absent from the previous roll are not flagged');
});

test('getMovedIds never flags players in manual tables', () => {
  const p = mk(6);
  const at = (...n) => n.map((i) => p[i - 1]);
  const prev = roll(at(1, 2, 3), at(4, 5, 6));
  const next = { tables: [{ players: at(4, 5, 6), manual: true }, { players: at(1, 2, 3), manual: true }] };
  assert.equal(getMovedIds(next, prev).size, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLayouts,
  shuffle,
  buildPairHistory,
  scoreTables,
  optimizeTables,
  splitPool,
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

test('splitPool removes manual players from the pool and drops absent ids', () => {
  const p = mk(8);
  const { manualTables, pool } = splitPool(p, [['p1', 'p2', 'p3'], ['p3', 'p4', 'ghost']]);
  assert.deepEqual(manualTables.map((t) => t.map((x) => x.id)), [['p1', 'p2', 'p3'], ['p4']]);
  assert.deepEqual(pool.map((x) => x.id), ['p5', 'p6', 'p7', 'p8']);
});

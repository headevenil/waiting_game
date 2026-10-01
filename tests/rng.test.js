import test from 'node:test';
import assert from 'node:assert/strict';
import { next, makeRng } from '../public/js/rng.js';
import { draw, remember } from '../public/js/content.js';

test('same seed gives the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  assert.equal(a.seed(), b.seed());
});

test('values are in [0, 1)', () => {
  let seed = 7;
  for (let i = 0; i < 10000; i++) {
    const o = next(seed);
    assert.ok(o.value >= 0 && o.value < 1);
    seed = o.seed;
  }
});

test('draws never repeat within the recent buffer', () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}` }));
  let recent = [];
  const r = makeRng(1);
  for (let i = 0; i < 20; i++) {
    const [x] = draw(r, pool, 1, recent);
    assert.ok(!recent.includes(x.id), `repeat at ${i}`);
    recent = remember(recent, [x.id]);
  }
  // Pool exhausted: the oldest half is released, so a draw still succeeds.
  const [y] = draw(r, pool, 1, recent);
  assert.ok(recent.slice(0, 10).includes(y.id));
});

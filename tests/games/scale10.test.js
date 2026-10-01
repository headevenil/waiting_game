import test from 'node:test';
import assert from 'node:assert/strict';
import scale10, { mistakes } from '../../public/js/games/scale10.js';
import { P5, C } from '../fixtures.js';

function toSort(s) {
  s = scale10.reduce(s, { type: 'DEAL' });
  for (const id of s.rounds[s.round].answerers) s = scale10.reduce(s, { type: 'PEEKED', playerId: id });
  assert.equal(s.phase, 'answer');
  return scale10.reduce(s, { type: 'SORT' });
}
const sorted = (s) => {
  const { answerers, numbers } = s.rounds[s.round];
  return answerers.slice().sort((a, b) => numbers[a] - numbers[b]);
};

test('numbers are 1–10 without repeats; captain gets none', () => {
  const s = scale10.init({ players: P5, options: {}, content: C, seed: 3 });
  for (const r of s.rounds) {
    const ns = Object.values(r.numbers);
    assert.equal(ns.length, 4);
    assert.equal(new Set(ns).size, 4);
    assert.ok(ns.every((n) => n >= 1 && n <= 10));
    assert.ok(!(r.captainId in r.numbers));
  }
  assert.deepEqual(s.rounds.map((r) => r.captainId), ['p1', 'p2', 'p3', 'p4', 'p5']);
});

test('mistake counting: a card smaller than one above it costs 1', () => {
  const nums = { a: 2, b: 5, c: 3, d: 9 };
  assert.deepEqual(mistakes(['a', 'b', 'c', 'd'], nums), { wrong: 1, flags: [false, false, true, false] });
  assert.equal(mistakes(['d', 'c', 'b', 'a'], nums).wrong, 3);
  assert.equal(mistakes(['a', 'c', 'b', 'd'], nums).wrong, 0);
});

test('perfect session → 팀 승리 with 8 hearts', () => {
  let s = scale10.init({ players: P5, options: {}, content: C, seed: 3 });
  s = toSort(s);
  s = scale10.reduce(s, { type: 'MEMO', playerId: 'p2', text: '롤러코스터 고장' });  // memo only in answer phase
  assert.equal(s.memos.p2, undefined);
  for (let r = 0; r < 5; r++) {
    if (r) s = toSort(s);
    s = scale10.reduce(s, { type: 'LOCK', order: sorted(s) });
    assert.equal(scale10.view(s).props.caption, '완벽한 선장!');
    s = scale10.reduce(s, { type: 'NEXT' });
  }
  assert.deepEqual(scale10.result(s), { caption: '팀 승리!', tone: 'good', points: {}, team: { score: 8, max: 8 } });
});

test('running out of hearts ends the session early', () => {
  let s = scale10.init({ players: P5, options: {}, content: C, seed: 3 });
  let rounds = 0;
  while (s.phase !== 'final') {
    s = toSort(s);
    s = scale10.reduce(s, { type: 'LOCK', order: sorted(s).reverse() });   // 3 mistakes each
    s = scale10.reduce(s, { type: 'NEXT' });
    rounds++;
  }
  assert.equal(rounds, 3);
  assert.equal(scale10.result(s).caption, '아쉽다! 다시 도전');
});

test('memos and invalid locks', () => {
  let s = scale10.init({ players: P5, options: { rounds: 1 }, content: C, seed: 3 });
  s = scale10.reduce(s, { type: 'DEAL' });
  for (const id of s.rounds[0].answerers) s = scale10.reduce(s, { type: 'PEEKED', playerId: id });
  s = scale10.reduce(s, { type: 'MEMO', playerId: 'p2', text: '롤러코스터 고장' });
  assert.equal(s.memos.p2, '롤러코스터 고장');
  s = scale10.reduce(s, { type: 'SORT' });
  assert.equal(scale10.reduce(s, { type: 'LOCK', order: ['p2', 'p3'] }), s);
  assert.equal(scale10.reduce(s, { type: 'LOCK', order: ['p1', 'p2', 'p3', 'p4'] }), s);  // captain isn't a card
});

test('unknown actions return the same state', () => {
  const s = scale10.init({ players: P5, options: {}, content: C, seed: 3 });
  assert.equal(scale10.reduce(s, { type: 'NOPE' }), s);
});

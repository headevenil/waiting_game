import test from 'node:test';
import assert from 'node:assert/strict';
import dial, { scoreFor } from '../../public/js/games/dial.js';
import { P5, C } from '../fixtures.js';

const toTune = (s) => {
  s = dial.reduce(s, { type: 'PEEKED', playerId: s.rounds[s.round].setterId });
  return dial.reduce(s, { type: 'TUNE', text: '신라면' });
};

test('scoring table', () => {
  assert.deepEqual([0, 4, 5, 12, 13, 20, 21, 100].map((d) => scoreFor(50 + Math.min(d, 50), 50).points), [4, 4, 3, 3, 2, 2, 0, 0]);
  assert.equal(scoreFor(10, 10).caption, '과녁 정중앙!');
  assert.equal(scoreFor(0, 60).caption, '텔레파시 실패');
});

test('setter rotates; targets in 0–100; only the setter can peek', () => {
  const s = dial.init({ players: P5, options: {}, content: C, seed: 11 });
  assert.deepEqual(s.rounds.map((r) => r.setterId), ['p1', 'p2', 'p3', 'p4', 'p5']);
  assert.ok(s.rounds.every((r) => r.target >= 0 && r.target <= 100 && Number.isInteger(r.target)));
  assert.equal(dial.reduce(s, { type: 'PEEKED', playerId: 'p2' }), s);
});

test('target is absent from the tune view', () => {
  const s = toTune(dial.init({ players: P5, options: {}, content: C, seed: 11 }));
  const v = dial.view(s);
  assert.equal(v.screen, 'dial');
  assert.equal(v.props.mode, 'tune');
  assert.ok(!('target' in v.props));
  assert.equal(v.props.clue, '신라면');
});

test('full session: perfect needles → 20 points, 이심전심', () => {
  let s = dial.init({ players: P5, options: {}, content: C, seed: 11 });
  while (s.phase !== 'final') {
    s = toTune(s);
    s = dial.reduce(s, { type: 'LOCK', value: s.rounds[s.round].target });
    assert.equal(s.points, 4);
    s = dial.reduce(s, { type: 'NEXT' });
  }
  assert.deepEqual(dial.result(s), { caption: '이심전심', tone: 'good', points: {}, team: { score: 20, max: 20 } });
});

test('12 points over 5 rounds → 찰떡궁합; needle clamped', () => {
  let s = dial.init({ players: P5, options: {}, content: C, seed: 11 });
  const offsets = [0, 0, 6, 14, 30];   // 4 + 4 + 3 + 2 + 0 = 13
  for (const d of offsets) {
    s = toTune(s);
    const t = s.rounds[s.round].target;
    s = dial.reduce(s, { type: 'LOCK', value: t + d <= 100 ? t + d : t - d });
    s = dial.reduce(s, { type: 'NEXT' });
  }
  assert.equal(s.total, 13);
  assert.equal(dial.result(s).caption, '찰떡궁합');
  let t = toTune(dial.init({ players: P5, options: { rounds: 1 }, content: C, seed: 1 }));
  t = dial.reduce(t, { type: 'LOCK', value: 150 });
  assert.equal(t.needle, 100);
});

test('unknown actions return the same state', () => {
  const s = dial.init({ players: P5, options: {}, content: C, seed: 1 });
  assert.equal(dial.reduce(s, { type: 'NOPE' }), s);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import liar from '../../public/js/games/liar.js';
import { P5, C } from '../fixtures.js';

const start = (opts = { mode: '일반' }, seed = 42) => {
  let s = liar.init({ players: P5, options: opts, content: C, seed });
  for (const p of P5) s = liar.reduce(s, { type: 'PEEKED', playerId: p.id, now: 0 });
  return s;
};
const notLiar = (s) => P5.find((p) => p.id !== s.liarId).id;

test('liar caught but guesses the word → liar +2', () => {
  let s = start();
  s = liar.reduce(s, { type: 'START_VOTE' });
  s = liar.reduce(s, { type: 'ACCUSE', playerId: s.liarId });
  s = liar.reduce(s, { type: 'LIAR_GUESS', correct: true });
  assert.deepEqual(liar.result(s).points, { [s.liarId]: 2 });
  assert.equal(liar.result(s).caption, '역전승!');
});

test('liar caught and guesses wrong → each 시민 +1', () => {
  let s = start();
  s = liar.reduce(s, { type: 'START_VOTE' });
  s = liar.reduce(s, { type: 'ACCUSE', playerId: s.liarId });
  assert.equal(liar.result(s), null);
  s = liar.reduce(s, { type: 'LIAR_GUESS', correct: false });
  const pts = liar.result(s).points;
  assert.equal(Object.keys(pts).length, 4);
  assert.ok(!(s.liarId in pts));
  assert.equal(liar.result(s).caption, '라이어 검거!');
});

test('wrong accusation → liar +3', () => {
  let s = start();
  s = liar.reduce(s, { type: 'START_VOTE' });
  s = liar.reduce(s, { type: 'ACCUSE', playerId: notLiar(s) });
  assert.deepEqual(liar.result(s).points, { [s.liarId]: 3 });
});

test('tie → revote between tied; second tie → liar escapes', () => {
  let s = start();
  s = liar.reduce(s, { type: 'START_VOTE' });
  s = liar.reduce(s, { type: 'TIE', playerIds: ['p1', 'p2'] });
  assert.deepEqual(s.vote, { round: 2, candidates: ['p1', 'p2'] });
  const same = liar.reduce(s, { type: 'ACCUSE', playerId: 'p3' });   // not a candidate
  assert.equal(same, s);
  s = liar.reduce(s, { type: 'TIE', playerIds: [] });
  assert.deepEqual(liar.result(s).points, { [s.liarId]: 3 });
});

test('the liar never speaks first, across many seeds', () => {
  for (let seed = 1; seed < 200; seed++) {
    const s = liar.init({ players: P5, options: {}, content: C, seed });
    assert.notEqual(s.order[0], s.liarId);
    assert.equal(new Set(s.order).size, 5);
  }
});

test('바보 모드: liar sees the decoy in the same layout', () => {
  const s = liar.init({ players: P5, options: { mode: '바보' }, content: C, seed: 3 });
  const liarIdx = P5.findIndex((p) => p.id === s.liarId);
  let t = s;
  for (let i = 0; i < liarIdx; i++) t = liar.reduce(t, { type: 'PEEKED', playerId: P5[i].id });
  const v = liar.view(t);
  assert.equal(v.props.secret.big, s.decoy);
  assert.equal(v.props.secret.top, `주제: ${s.topic}`);
});

test('reveal must go in order; describe flow; re-peek returns to describe', () => {
  let s = liar.init({ players: P5, options: { timer: 180 }, content: C, seed: 5 });
  assert.equal(liar.reduce(s, { type: 'PEEKED', playerId: 'p2' }), s);
  for (const p of P5) s = liar.reduce(s, { type: 'PEEKED', playerId: p.id, now: 1000 });
  assert.equal(s.phase, 'describe');
  assert.equal(s.timer.deadline, 1000 + 180000);
  s = liar.reduce(s, { type: 'NEXT_SPEAKER' });
  assert.equal(s.speaker, 1);
  s = liar.reduce(s, { type: 'REPEEK' });
  s = liar.reduce(s, { type: 'REPEEK_PICK', playerId: 'p3' });
  assert.equal(liar.view(s).gate.playerId, 'p3');
  s = liar.reduce(s, { type: 'PEEKED', playerId: 'p3' });
  assert.equal(s.phase, 'describe');
  s = liar.reduce(s, { type: 'TIMER_PAUSE', now: 31000 });
  assert.equal(s.timer.remaining, 150000);
  s = liar.reduce(s, { type: 'TIMER_RESUME', now: 100000 });
  assert.equal(s.timer.deadline, 250000);
});

test('unknown actions return the same state object', () => {
  const s = start();
  assert.equal(liar.reduce(s, { type: 'WHAT' }), s);
});

test('timer option 0 means no timer', () => {
  const s = start({ timer: 0 });
  assert.equal(s.timer, null);
});

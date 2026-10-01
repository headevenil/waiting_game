import test from 'node:test';
import assert from 'node:assert/strict';
import twenty from '../../public/js/games/twenty.js';
import { P5, C } from '../fixtures.js';

function toQuestions(seed = 6, options = {}) {
  let s = twenty.init({ players: P5, options, content: C, seed });
  for (const p of P5) s = twenty.reduce(s, { type: 'PEEKED', playerId: p.id });
  assert.equal(s.phase, 'ready');
  return twenty.reduce(s, { type: 'START', now: 0 });
}

test('roles: host by rotation, helper is someone else, yes/no word', () => {
  const s = twenty.init({ players: P5, options: {}, content: C, seed: 1, fairness: { lastLeader: { twenty: 'p2' } } });
  assert.equal(s.hostId, 'p3');
  assert.notEqual(s.helperId, s.hostId);
  assert.notEqual(s.wordId, 'w16');
});

test('three screens share one layout', () => {
  let s = twenty.init({ players: P5, options: {}, content: C, seed: 1 });
  const shapes = new Set();
  for (const p of P5) {
    shapes.add(Object.keys(twenty.view(s).props.secret).join());
    s = twenty.reduce(s, { type: 'PEEKED', playerId: p.id });
  }
  assert.equal(shapes.size, 1);
});

test('time runs out → nobody scores', () => {
  let s = toQuestions();
  assert.equal(twenty.reduce(s, { type: 'TICK', now: 100_000 }), s);
  s = twenty.reduce(s, { type: 'TICK', now: 240_000 });
  assert.deepEqual(twenty.result(s), { caption: '시간 초과!', tone: 'bad', points: {} });
});

test('discussion timer equals time the questioning took (paused time excluded)', () => {
  let s = toQuestions();
  s = twenty.reduce(s, { type: 'TIMER_PAUSE', now: 30_000 });
  s = twenty.reduce(s, { type: 'TIMER_RESUME', now: 500_000 });
  s = twenty.reduce(s, { type: 'FOUND', now: 560_000 });
  assert.equal(s.elapsed, 90);
  const guesser = P5.find((p) => p.id !== s.hostId).id;
  s = twenty.reduce(s, { type: 'GUESSED', playerId: guesser, now: 1_000_000 });
  assert.equal(s.timer.total, 90);
  assert.equal(s.timer.deadline, 1_090_000);
});

test('helper caught → host and each 일반 +1', () => {
  let s = toQuestions();
  s = twenty.reduce(s, { type: 'FOUND', now: 10_000 });
  s = twenty.reduce(s, { type: 'GUESSED', playerId: s.helperId, now: 10_000 });
  assert.equal(s.timer.total, 30);                         // minimum discussion
  s = twenty.reduce(s, { type: 'START_VOTE' });
  assert.equal(twenty.reduce(s, { type: 'ACCUSE', playerId: s.hostId }), s);
  s = twenty.reduce(s, { type: 'ACCUSE', playerId: s.helperId });
  const pts = twenty.result(s).points;
  assert.equal(Object.keys(pts).length, 4);
  assert.equal(pts[s.hostId], 1);
  assert.ok(!(s.helperId in pts));
});

test('helper escapes → helper +3', () => {
  let s = toQuestions();
  s = twenty.reduce(s, { type: 'FOUND', now: 10_000 });
  const innocent = P5.find((p) => p.id !== s.hostId && p.id !== s.helperId).id;
  s = twenty.reduce(s, { type: 'GUESSED', playerId: innocent, now: 10_000 });
  s = twenty.reduce(s, { type: 'START_VOTE' });
  s = twenty.reduce(s, { type: 'ACCUSE', playerId: innocent });
  assert.deepEqual(twenty.result(s), { caption: '조력자 승리!', tone: 'bad', points: { [s.helperId]: 3 } });
});

test('time option and +30초', () => {
  let s = toQuestions(2, { time: 180 });
  assert.equal(s.timer.deadline, 180_000);
  s = twenty.reduce(s, { type: 'TIMER_ADD', sec: 30, now: 1000 });
  assert.equal(s.timer.deadline, 210_000);
});

test('unknown actions return the same state', () => {
  const s = toQuestions();
  assert.equal(twenty.reduce(s, { type: 'NOPE' }), s);
});

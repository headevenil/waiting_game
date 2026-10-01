import test from 'node:test';
import assert from 'node:assert/strict';
import fading, { writeError } from '../../public/js/games/fading.js';
import { P5, C } from '../fixtures.js';

const guessersOf = (s) => {
  const w = s.rounds[s.round].writerId;
  const i = P5.findIndex((p) => p.id === w);
  return [...P5.slice(i + 1), ...P5.slice(0, i)].map((p) => p.id);
};

function playRound(s, guessFor) {
  const c = s.rounds[s.round].candidates[0];
  s = fading.reduce(s, { type: 'PICK', wordId: c.id });
  s = fading.reduce(s, { type: 'WRITE', clues: ['힌트하나', '힌트둘', '힌트셋', '힌트넷'] });
  const counts = [];
  guessersOf(s).forEach((id, i) => {
    counts.push(fading.view(s).props.clues.length);
    s = fading.reduce(s, { type: 'GUESS', playerId: id, text: guessFor(i, c.text) });
    if (s.phase === 'erase') s = fading.reduce(s, { type: 'ERASE', index: s.clues.findIndex((x) => !x.erasedBy) });
  });
  return { s, counts, word: c };
}

test('clue count drops 4 → 1 across guessers', () => {
  const s0 = fading.init({ players: P5, options: { rounds: 1 }, content: C, seed: 4 });
  const { s, counts } = playRound(s0, () => '몰라');
  assert.deepEqual(counts, [4, 3, 2, 1]);
  assert.equal(s.phase, 'reveal');
});

test('a clue containing the answer is rejected', () => {
  const w = { text: '떡볶이', aliases: [] };
  assert.equal(writeError(['매운떡볶이', 'b', 'c', 'd'], w), '정답이 들어가 있어요');
  assert.equal(writeError(['a', 'b', 'c'], w), '힌트 4개를 모두 써 주세요');
  assert.equal(writeError(['가나다라마바사아자차카타파', 'b', 'c', 'd'], w), '힌트는 12글자까지만 돼요');
  let s = fading.init({ players: P5, options: { rounds: 1 }, content: C, seed: 4 });
  const c = s.rounds[0].candidates[0];
  s = fading.reduce(s, { type: 'PICK', wordId: c.id });
  assert.equal(fading.reduce(s, { type: 'WRITE', clues: [c.text, 'b', 'c', 'd'] }).phase, 'write');
});

test('scoring: each correct guesser +1, writer +1 per correct guesser; 정답 인정 toggle', () => {
  const s0 = fading.init({ players: P5, options: { rounds: 1 }, content: C, seed: 4 });
  let { s, word } = playRound(s0, (i, answer) => (i < 2 ? answer.normalize('NFD') + ' ' : '오답'));
  const [g1, g2, g3] = guessersOf(s);
  assert.ok(s.guesses[g1].ok && s.guesses[g2].ok && !s.guesses[g3].ok);
  s = fading.reduce(s, { type: 'TOGGLE', playerId: g3 });
  s = fading.reduce(s, { type: 'SCORE' });
  assert.equal(s.phase, 'final');
  const writer = s.rounds[0].writerId;
  assert.deepEqual(fading.result(s).points, { [g1]: 1, [g2]: 1, [g3]: 1, [writer]: 3 });
  assert.ok(word.text);
});

test('erase is mandatory and an erased clue cannot be erased twice', () => {
  let s = fading.init({ players: P5, options: { rounds: 1 }, content: C, seed: 4 });
  s = fading.reduce(s, { type: 'PICK', wordId: s.rounds[0].candidates[1].id });
  s = fading.reduce(s, { type: 'WRITE', clues: ['a', 'b', 'c', 'd'] });
  const [g1, g2] = guessersOf(s);
  assert.equal(fading.reduce(s, { type: 'GUESS', playerId: g2, text: 'x' }), s);   // out of turn
  s = fading.reduce(s, { type: 'GUESS', playerId: g1, text: 'x' });
  assert.equal(s.phase, 'erase');
  assert.equal(fading.reduce(s, { type: 'GUESS', playerId: g2, text: 'y' }), s);   // must erase first
  s = fading.reduce(s, { type: 'ERASE', index: 0 });
  s = fading.reduce(s, { type: 'GUESS', playerId: g2, text: 'y' });
  assert.equal(fading.reduce(s, { type: 'ERASE', index: 0 }), s);
});

test('writer rotates each round; one round per player by default', () => {
  let s = fading.init({ players: P5, options: {}, content: C, seed: 8 });
  assert.equal(s.rounds.length, 5);
  assert.deepEqual(s.rounds.map((r) => r.writerId), ['p1', 'p2', 'p3', 'p4', 'p5']);
  for (let r = 0; r < 5; r++) {
    ({ s } = playRound(s, () => '오답'));
    s = fading.reduce(s, { type: 'SCORE' });
  }
  assert.equal(s.phase, 'final');
  assert.deepEqual(fading.result(s).points, {});
});

test('six players: the last two guessers share the final clue', () => {
  const P6 = [...P5, { id: 'p6', name: '지호', color: 'purple' }];
  let s = fading.init({ players: P6, options: { rounds: 1 }, content: C, seed: 2 });
  s = fading.reduce(s, { type: 'PICK', wordId: s.rounds[0].candidates[0].id });
  s = fading.reduce(s, { type: 'WRITE', clues: ['a', 'b', 'c', 'd'] });
  const order = ['p2', 'p3', 'p4', 'p5', 'p6'];
  for (const id of order) {
    s = fading.reduce(s, { type: 'GUESS', playerId: id, text: 'x' });
    if (s.phase === 'erase') s = fading.reduce(s, { type: 'ERASE', index: s.clues.findIndex((x) => !x.erasedBy) });
  }
  assert.equal(s.phase, 'reveal');
  assert.equal(s.clues.filter((c) => !c.erasedBy).length, 1);
});

test('unknown actions return the same state', () => {
  const s = fading.init({ players: P5, options: {}, content: C, seed: 1 });
  assert.equal(fading.reduce(s, { type: 'NOPE' }), s);
});

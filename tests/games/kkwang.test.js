import test from 'node:test';
import assert from 'node:assert/strict';
import kkwang, { clueError } from '../../public/js/games/kkwang.js';
import { P5, C } from '../fixtures.js';

const init = (seed = 1, options = {}) => kkwang.init({ players: P5, options, content: C, seed });
const givers = (s) => {
  const g = s.leaders[s.played % 5];
  const i = P5.findIndex((p) => p.id === g);
  return [...P5.slice(i + 1), ...P5.slice(0, i)].map((p) => p.id);
};

function clues(s, texts) {
  givers(s).forEach((id, i) => { s = kkwang.reduce(s, { type: 'CLUE', playerId: id, text: texts[i] }); });
  return s;
}

test('deck: one card per player by default, 3 or 10 when chosen; no 드라마·예능 or 영화', () => {
  assert.equal(init().deck.length, 5);
  assert.equal(init(1, { cards: 3 }).deck.length, 3);
  const s = init(1, { cards: 10 });
  assert.equal(s.deck.length, 10);
  assert.ok(s.deck.every((c) => c.id !== 'w16'));
  const movie = { id: 'w17', text: '기생충', cat: '영화', diff: 1, yesno: false, decoy: '설국열차', aliases: [] };
  const all = kkwang.init({ players: P5, options: { cards: 10 }, content: { ...C, words: [...C.words, movie] }, seed: 1 });
  assert.ok(all.deck.every((c) => c.id !== 'w17'));
  assert.equal(kkwang.view(kkwang.init({ players: P5.slice(0, 4), options: {}, content: C, seed: 1 })).round, '1/4');
});

test('clue validation: spaces, length, contains answer', () => {
  const c = { text: '떡볶이', aliases: ['떡뽁이'] };
  assert.equal(clueError('빨간 맛', c), '띄어쓰기 없이 한 단어로 써요');
  assert.equal(clueError('가나다라마바사아자차카', c), '10글자까지만 돼요');
  assert.equal(clueError('매운떡볶이', c), '정답이 들어가 있어요');
  assert.equal(clueError('떡뽁이', c), '정답이 들어가 있어요');
  assert.equal(clueError('분식', c), null);
});

test('exact duplicates cancel after norm(); guesser sees survivors; correct +1', () => {
  let s = kkwang.reduce(init(), { type: 'BEGIN' });
  s = clues(s, ['빨강', '빨 강', '매움', '학교앞']);
  // '빨 강' has a space and is rejected, so the second giver is still up
  assert.equal(s.phase, 'clue');
  assert.equal(s.turn, 1);
  s = kkwang.reduce(s, { type: 'CLUE', playerId: givers(s)[1], text: '빨강!' });
  s = kkwang.reduce(s, { type: 'CLUE', playerId: givers(s)[2], text: '매움' });
  s = kkwang.reduce(s, { type: 'CLUE', playerId: givers(s)[3], text: '학교앞' });
  assert.equal(s.phase, 'compare');
  const [a, b] = givers(s);
  assert.equal(s.cancel[a], 'dup');
  assert.equal(s.cancel[b], 'dup');
  s = kkwang.reduce(s, { type: 'SHOW' });
  const v = kkwang.view(s);
  assert.equal(v.props.cards.filter((c) => c.dead).length, 2);
  s = kkwang.reduce(s, { type: 'JUDGE', result: 'correct' });
  assert.equal(s.score, 1);
});

test('같은 말 merge, 무효, restore', () => {
  let s = kkwang.reduce(init(), { type: 'BEGIN' });
  s = clues(s, ['야옹', '냥냥', '털', '집사']);
  const [a, b, c] = givers(s);
  s = kkwang.reduce(s, { type: 'MERGE', playerIds: [a, b] });
  assert.equal(s.cancel[a], 'same');
  s = kkwang.reduce(s, { type: 'INVALID', playerId: c });
  assert.equal(s.cancel[c], 'invalid');
  s = kkwang.reduce(s, { type: 'RESTORE', playerId: c });
  assert.ok(!(c in s.cancel));
});

test('all clues cancelled → card lost automatically', () => {
  let s = kkwang.reduce(init(), { type: 'BEGIN' });
  s = clues(s, ['빨강', '빨강', '매움', '매움']);
  s = kkwang.reduce(s, { type: 'SHOW' });
  assert.equal(s.phase, 'reveal');
  assert.equal(s.results[0], 'allkkwang');
  assert.equal(kkwang.view(s).props.caption, '전부 꽝!');
});

test('wrong discards the next card too; pass discards only this one', () => {
  let s = kkwang.reduce(init(), { type: 'BEGIN' });
  s = clues(s, ['가', '나', '다', '라']);
  s = kkwang.reduce(s, { type: 'SHOW' });
  s = kkwang.reduce(s, { type: 'JUDGE', result: 'wrong' });
  s = kkwang.reduce(s, { type: 'NEXT' });
  assert.equal(s.idx, 2);
  assert.equal(s.results[1], 'discarded');
  assert.equal(s.played, 1);
  s = kkwang.reduce(s, { type: 'BEGIN' });
  s = clues(s, ['가', '나', '다', '라']);
  s = kkwang.reduce(s, { type: 'SHOW' });
  s = kkwang.reduce(s, { type: 'JUDGE', result: 'pass' });
  s = kkwang.reduce(s, { type: 'NEXT' });
  assert.equal(s.idx, 3);
});

test('default session: everyone is 술래 once → 5/5 완벽해요!', () => {
  let s = init(9);
  const seen = [];
  while (s.phase !== 'final') {
    seen.push(s.leaders[s.played % 5]);
    s = kkwang.reduce(s, { type: 'BEGIN' });
    s = clues(s, ['가', '나', '다', '라']);
    s = kkwang.reduce(s, { type: 'SHOW' });
    s = kkwang.reduce(s, { type: 'JUDGE', result: 'correct' });
    s = kkwang.reduce(s, { type: 'NEXT' });
  }
  assert.deepEqual(kkwang.result(s), { caption: '완벽해요!', tone: 'good', points: {}, team: { score: 5, max: 5 } });
  assert.deepEqual([...seen].sort(), P5.map((p) => p.id).sort());
});

test('10-card session of correct answers → 10/10 완벽해요!, 술래 rotates every word', () => {
  let s = init(9, { cards: 10 });
  const seen = [];
  while (s.phase !== 'final') {
    seen.push(s.leaders[s.played % 5]);
    s = kkwang.reduce(s, { type: 'BEGIN' });
    s = clues(s, ['가', '나', '다', '라']);
    s = kkwang.reduce(s, { type: 'SHOW' });
    s = kkwang.reduce(s, { type: 'JUDGE', result: 'correct' });
    s = kkwang.reduce(s, { type: 'NEXT' });
  }
  assert.deepEqual(kkwang.result(s), { caption: '완벽해요!', tone: 'good', points: {}, team: { score: 10, max: 10 } });
  for (const p of P5) assert.equal(seen.filter((x) => x === p.id).length, 2);
});

test('score captions scale with the deck size', () => {
  const at = (score, n = 10) => kkwang.result({ phase: 'final', score, deck: Array(n).fill({}) }).caption;
  assert.equal(at(9), '대단해요');
  assert.equal(at(6), '괜찮은데?');
  assert.equal(at(4), '조금만 더');
  assert.equal(at(2), '다시 해봐요');
  assert.equal(at(5, 5), '완벽해요!');
  assert.equal(at(4, 5), '대단해요');
  assert.equal(at(3, 5), '괜찮은데?');
  assert.equal(at(1, 5), '다시 해봐요');
});

test('unknown actions return the same state', () => {
  const s = init();
  assert.equal(kkwang.reduce(s, { type: 'NOPE' }), s);
});

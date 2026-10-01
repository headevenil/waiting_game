// 겹치면 꽝 (Just One-style)
import { josa } from '../i18n/josa.js';
import { norm, contains, len } from '../i18n/norm.js';
import { draw } from '../content.js';
import { rng, rotateAfter, othersAfter, nameOf } from './common.js';

const DECK = 10;
const MAX_LEN = 10;

const guesserOf = (s) => s.leaders[s.played % s.leaders.length];
const giversOf = (s) => othersAfter(s.players, guesserOf(s));
const card = (s) => s.deck[s.idx];

export function clueError(text, c) {
  const t = String(text ?? '').trim();
  if (!t) return '힌트를 써 주세요';
  if (/\s/.test(t)) return '띄어쓰기 없이 한 단어로 써요';
  if (len(t) > MAX_LEN) return `${MAX_LEN}글자까지만 돼요`;
  if (contains(t, c.text, c.aliases)) return '정답이 들어가 있어요';
  return null;
}

// Exact duplicates after norm() cancel each other.
function autoCancel(clues) {
  const groups = {};
  for (const [id, text] of Object.entries(clues)) (groups[norm(text)] ??= []).push(id);
  const cancel = {};
  for (const ids of Object.values(groups)) if (ids.length > 1) for (const id of ids) cancel[id] = 'dup';
  return cancel;
}

const CAPTIONS = [[10, '완벽해요!'], [8, '대단해요'], [6, '괜찮은데?'], [4, '조금만 더'], [0, '다시 해봐요']];
const finalCaption = (score) => CAPTIONS.find(([min]) => score >= min)[1];

const REVEAL = {
  correct: { caption: '정답!', tone: 'good' },
  wrong: { caption: '아깝다~', tone: 'bad' },
  pass: { caption: '패스!', tone: 'neutral' },
  allkkwang: { caption: '전부 꽝!', tone: 'bad' },
};

function result(s) {
  if (s.phase !== 'final') return null;
  return { caption: finalCaption(s.score), tone: s.score >= 6 ? 'good' : 'neutral', points: {}, team: { score: s.score, max: DECK } };
}

export default {
  id: 'kkwang',
  title: '겹치면 꽝',
  rules: ['술래만 제시어를 몰라요.', '나머지는 몰래 한 단어 힌트를 써요. 겹치면 꽝!', '남은 힌트로 술래가 맞히면 성공!'],
  players: { min: 4, max: 6, best: 5 },
  minutes: [10, 15],
  options: {},

  init({ players, content, seed, fairness }) {
    const r = rng(seed);
    const pool = content.words.filter((w) => w.diff <= 2 && w.cat !== '드라마·예능');
    const deck = draw(r, pool, DECK, content.recent?.words).map((w) => ({ id: w.id, text: w.text, aliases: w.aliases ?? [] }));
    return {
      phase: 'setup', players, deck, idx: 0, played: 0,
      leaders: rotateAfter(players, fairness?.lastLeader?.kkwang),
      turn: 0, clues: {}, cancel: {}, results: deck.map(() => null), score: 0,
      rng: r.seed(), used: { words: deck.map((c) => c.id) },
    };
  },

  reduce(s, a) {
    switch (s.phase) {
      case 'setup':
        if (a.type === 'BEGIN') return { ...s, phase: 'clue', turn: 0, clues: {}, cancel: {} };
        break;
      case 'clue': {
        const giver = giversOf(s)[s.turn];
        if (a.type !== 'CLUE' || a.playerId !== giver || clueError(a.text, card(s))) break;
        const clues = { ...s.clues, [giver]: String(a.text).trim() };
        const turn = s.turn + 1;
        if (turn < giversOf(s).length) return { ...s, clues, turn };
        return { ...s, clues, turn, phase: 'compare', cancel: autoCancel(clues) };
      }
      case 'compare':
        if (a.type === 'MERGE' && a.playerIds?.length === 2 && a.playerIds.every((id) => id in s.clues)) {
          return { ...s, cancel: { ...s.cancel, [a.playerIds[0]]: 'same', [a.playerIds[1]]: 'same' } };
        }
        if (a.type === 'INVALID' && a.playerId in s.clues) return { ...s, cancel: { ...s.cancel, [a.playerId]: 'invalid' } };
        if (a.type === 'RESTORE' && a.playerId in s.cancel) {
          const cancel = { ...s.cancel };
          delete cancel[a.playerId];
          return { ...s, cancel };
        }
        if (a.type === 'SHOW') {
          const alive = Object.keys(s.clues).filter((id) => !s.cancel[id]);
          if (!alive.length) {
            const results = s.results.slice();
            results[s.idx] = 'allkkwang';
            return { ...s, results, phase: 'reveal' };
          }
          return { ...s, phase: 'guess' };
        }
        break;
      case 'guess':
        if (a.type === 'JUDGE' && ['correct', 'wrong', 'pass'].includes(a.result)) {
          const results = s.results.slice();
          results[s.idx] = a.result;
          return { ...s, results, phase: 'reveal', score: s.score + (a.result === 'correct' ? 1 : 0) };
        }
        break;
      case 'reveal':
        if (a.type === 'NEXT') {
          const results = s.results.slice();
          let idx = s.idx + 1;
          if (results[s.idx] === 'wrong' && idx < s.deck.length) {   // a wrong guess also burns the next card
            results[idx] = 'discarded';
            idx += 1;
          }
          const base = { ...s, results, idx, played: s.played + 1, turn: 0, clues: {}, cancel: {} };
          return idx >= s.deck.length ? { ...base, phase: 'final' } : { ...base, phase: 'setup' };
        }
        break;
    }
    return s;
  },

  view(s) {
    const name = (id) => nameOf(s, id);
    const round = `${Math.min(s.idx + 1, DECK)}/${DECK}`;
    const g = guesserOf(s);
    const c = card(s);
    switch (s.phase) {
      case 'setup':
        return {
          key: `setup:${s.idx}`, round, screen: 'talk',
          props: {
            info: `점수 ${s.score}`,
            label: '이번 술래',
            big: `${josa(name(g), '이/가')} 술래!`, bigPlayer: g,
            sub: '술래는 뒤돌아 주세요. 나머지는 한 명씩 힌트를 써요.',
            deck: s.results,
            buttons: [{ label: '힌트 쓰기 시작', action: { type: 'BEGIN' } }],
          },
        };
      case 'clue': {
        const giver = giversOf(s)[s.turn];
        return {
          key: `clue:${s.idx}:${giver}`, round, gate: { playerId: giver, note: `${josa(name(g), '은/는')} 보면 안 돼요` },
          screen: 'holdInput',
          props: {
            secret: { top: '제시어', big: c.text, bottom: '한 단어 힌트를 떠올려요' },
            input: { placeholder: '한 단어 힌트', maxLength: MAX_LEN, check: { kind: 'clue', answer: c.text, aliases: c.aliases } },
            action: { type: 'CLUE', playerId: giver },
          },
        };
      }
      case 'compare':
        return {
          key: `compare:${s.idx}`, round, gate: { group: true, title: '술래 빼고 보세요', sub: `${josa(name(g), '은/는')} 아직 보면 안 돼요`, button: '술래는 안 보고 있어요' },
          screen: 'compare', undo: true,
          props: {
            word: c.text,
            clues: Object.entries(s.clues).map(([id, text]) => ({ playerId: id, text, cancel: s.cancel[id] ?? null })),
            show: { label: '술래에게 보여 주기', action: { type: 'SHOW' } },
          },
        };
      case 'guess': {
        const ids = Object.keys(s.clues);
        return {
          key: `guess:${s.idx}`, round, gate: { playerId: g, note: '남은 힌트를 보고 정답을 말해요' },
          screen: 'cards', undo: true,
          props: {
            label: '남은 힌트',
            cards: ids.map((id) => (s.cancel[id] ? { dead: true, text: '꽝' } : { text: s.clues[id] })),
            sub: '정답을 소리 내어 말하면, 다 같이 판정해요.',
            buttons: [
              { label: '맞음', action: { type: 'JUDGE', result: 'correct' }, kind: 'good' },
              { label: '틀림', action: { type: 'JUDGE', result: 'wrong' }, kind: 'bad' },
              { label: '패스', action: { type: 'JUDGE', result: 'pass' }, kind: 'secondary' },
            ],
          },
        };
      }
      case 'reveal': {
        const res = s.results[s.idx];
        const last = s.idx + 1 + (res === 'wrong' ? 1 : 0) >= s.deck.length;
        return {
          key: `reveal:${s.idx}`, round, screen: 'talk', undo: true,
          props: {
            caption: REVEAL[res].caption, tone: REVEAL[res].tone,
            label: '제시어', big: c.text,
            sub: res === 'wrong' ? '틀리면 다음 카드도 버려요.' : res === 'allkkwang' ? '힌트가 전부 겹쳐서 카드를 잃었어요.' : `점수 ${s.score}`,
            deck: s.results,
            buttons: [{ label: last ? '결과 보기' : '다음 단어', action: { type: 'NEXT' } }],
          },
        };
      }
      case 'final': {
        const res = result(s);
        return {
          key: 'final', screen: 'result', undo: true,
          props: { caption: res.caption, tone: res.tone, big: `${s.score} / ${DECK}`, lines: [{ label: '팀 점수', value: `${s.score}점` }], deck: s.results },
        };
      }
    }
    return { key: 'none', screen: 'talk', props: {} };
  },

  result,

  roles(s) { return { leader: s.leaders[0] }; },
};

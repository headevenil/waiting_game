// 사라지는 힌트 (Eraser-style fading clues)
import { same, contains, len } from '../i18n/norm.js';
import { draw } from '../content.js';
import { rng, pick, rotateAfter, othersAfter, roundsFor, withDefaults, nameOf, addPoints, roundsOption } from './common.js';

const CLUES = 4;
const MAX_LEN = 12;
const CATS = ['음식', '분식·간식', '편의점 간식', '과일', '술·안주', '장소', '프랜차이즈', '동물', '캐릭터', '물건', '브랜드', '직업',
  '놀이공원', '게임', '추억', '드라마·예능', '영화'];
const OPTIONS = { rounds: roundsOption('출제자') };

export function writeError(clues, word) {
  if (clues.length !== CLUES) return `힌트 ${CLUES}개를 모두 써 주세요`;
  for (const c of clues) {
    const t = String(c ?? '').trim();
    if (!t) return `힌트 ${CLUES}개를 모두 써 주세요`;
    if (len(t) > MAX_LEN) return `힌트는 ${MAX_LEN}글자까지만 돼요`;
    if (contains(t, word.text, word.aliases)) return '정답이 들어가 있어요';
  }
  return null;
}

const rd = (s) => s.rounds[s.round];
const guessersOf = (s) => othersAfter(s.players, rd(s).writerId);

function result(s) {
  if (s.phase !== 'final') return null;
  return { caption: '게임 끝!', tone: 'good', points: addPoints(s.scores) };
}

export default {
  id: 'fading',
  title: '사라지는 힌트',
  rules: ['출제자가 제시어에 대한 힌트를 4개 써요.', '폰을 받으면 몰래 정답을 쓰고, 힌트 하나를 지워요.', '맞히면 1점, 출제자는 맞힌 사람 수만큼 점수!'],
  sides: [
    { team: '개인전', who: '맞히는 사람', goal: '각자 맞히면 1점' },
    { team: '출제자', who: '맞히는 사람 편', goal: '모두가 맞힐수록 출제자 점수도 커요' },
  ],
  sidesNote: '힌트를 지울 때는 다음 사람이 맞힐 수 있게 좋은 힌트를 남겨요.',
  players: { min: 4, max: 6, best: 5 },
  minutes: [15, 20],
  options: OPTIONS,

  init({ players, options, content, seed, fairness }) {
    const o = withDefaults(options, OPTIONS);
    const r = rng(seed);
    const R = roundsFor(o.rounds, players);
    const leaders = rotateAfter(players, fairness?.lastLeader?.fading);
    let recent = content.recent?.words ?? [];
    const cats = CATS.filter((c) => content.words.filter((w) => w.cat === c).length >= 3);
    const usable = cats.length ? cats : [...new Set(content.words.map((w) => w.cat))];
    const rounds = [];
    for (let i = 0; i < R; i++) {
      const cat = pick(r, usable);
      const candidates = draw(r, content.words.filter((w) => w.cat === cat), 3, recent)
        .map((w) => ({ id: w.id, text: w.text, aliases: w.aliases ?? [] }));
      recent = [...recent, ...candidates.map((c) => c.id)];
      rounds.push({ writerId: leaders[i % leaders.length], cat, candidates });
    }
    return {
      phase: 'pick', players, round: 0, rounds, word: null, clues: [], g: 0, guesses: {}, scores: {},
      rng: r.seed(), used: { words: rounds.flatMap((x) => x.candidates.map((c) => c.id)) },
    };
  },

  reduce(s, a) {
    switch (s.phase) {
      case 'pick': {
        const w = rd(s).candidates.find((c) => c.id === a.wordId);
        if (a.type === 'PICK' && w) return { ...s, phase: 'write', word: w };
        break;
      }
      case 'write':
        if (a.type === 'WRITE' && Array.isArray(a.clues) && !writeError(a.clues, s.word)) {
          return { ...s, phase: 'guess', g: 0, guesses: {}, clues: a.clues.map((t) => ({ text: String(t).trim(), erasedBy: null })) };
        }
        break;
      case 'guess': {
        const id = guessersOf(s)[s.g];
        if (a.type !== 'GUESS' || a.playerId !== id || !String(a.text ?? '').trim()) break;
        const guesses = { ...s.guesses, [id]: { text: String(a.text).trim(), ok: same(a.text, s.word.text, s.word.aliases) } };
        if (s.g === guessersOf(s).length - 1) return { ...s, guesses, phase: 'reveal' };
        // Erasing is mandatory while more than one clue is left (6 players: the last two share one).
        const left = s.clues.filter((c) => !c.erasedBy).length;
        return left > 1 ? { ...s, guesses, phase: 'erase' } : { ...s, guesses, g: s.g + 1 };
      }
      case 'erase': {
        const id = guessersOf(s)[s.g];
        const c = s.clues[a.index];
        if (a.type !== 'ERASE' || !c || c.erasedBy) break;
        const clues = s.clues.map((x, i) => (i === a.index ? { ...x, erasedBy: id } : x));
        return { ...s, clues, g: s.g + 1, phase: 'guess' };
      }
      case 'reveal':
        if (a.type === 'TOGGLE' && s.guesses[a.playerId]) {
          const g = s.guesses[a.playerId];
          return { ...s, guesses: { ...s.guesses, [a.playerId]: { ...g, ok: !g.ok } } };
        }
        if (a.type === 'SCORE') {
          const right = Object.entries(s.guesses).filter(([, g]) => g.ok).map(([id]) => id);
          const pts = Object.fromEntries(right.map((id) => [id, 1]));
          const scores = addPoints(s.scores, pts, { [rd(s).writerId]: right.length });
          const round = s.round + 1;
          const base = { ...s, scores, round, word: null, clues: [], g: 0, guesses: {} };
          return round >= s.rounds.length ? { ...base, round: s.round, phase: 'final' } : { ...base, phase: 'pick' };
        }
        break;
    }
    return s;
  },

  view(s) {
    const name = (id) => nameOf(s, id);
    const R = s.rounds.length;
    const round = `${s.round + 1}/${R}`;
    const writer = rd(s).writerId;
    const writerGate = { playerId: writer, note: '출제자만 보세요' };
    switch (s.phase) {
      case 'pick':
        return {
          key: `w:${s.round}`, round, gate: writerGate, screen: 'pick',
          props: {
            title: '제시어를 하나 골라요', info: `카테고리: ${rd(s).cat}`,
            options: rd(s).candidates.map((c) => ({ label: c.text, action: { type: 'PICK', wordId: c.id } })),
          },
        };
      case 'write':
        return {
          key: `w:${s.round}`, round, gate: writerGate, screen: 'write',
          props: {
            info: '제시어', word: s.word.text,
            fields: CLUES, maxLength: MAX_LEN,
            sub: `힌트 ${CLUES}개를 써요. 짧은 말도 돼요.`,
            check: { kind: 'write', answer: s.word.text, aliases: s.word.aliases },
            action: { type: 'WRITE' },
          },
        };
      case 'guess':
      case 'erase': {
        const id = guessersOf(s)[s.g];
        const left = s.clues.filter((c) => !c.erasedBy).length;
        const last = s.g === guessersOf(s).length - 1 || left <= 1;
        return {
          key: `g:${s.round}:${id}`, round, gate: { playerId: id, note: '다른 사람은 보지 마세요' }, screen: 'eraser',
          props: {
            stage: s.phase,
            clues: s.clues.map((c, i) => ({ index: i, text: c.text, gone: !!c.erasedBy })).filter((c) => !c.gone),
            left,
            maxLength: MAX_LEN,
            guessAction: { type: 'GUESS', playerId: id },
            eraseAction: { type: 'ERASE' },
            note: s.g === guessersOf(s).length - 1 ? '마지막 사람이에요. 남은 힌트로 맞혀 봐요!'
              : last ? '힌트가 하나뿐이라 지우지 않아요.' : '정답을 쓰고, 다음 사람을 위해 힌트 하나를 지워요.',
          },
        };
      }
      case 'reveal':
        return {
          key: `r:${s.round}`, round, gate: { group: true, title: '다 같이 보세요', sub: '정답을 공개할게요', button: '정답 공개' },
          screen: 'judge', undo: true,
          props: {
            caption: s.word.text,
            info: `출제자: ${name(writer)}`,
            guesses: guessersOf(s).map((id) => ({ playerId: id, text: s.guesses[id]?.text ?? '', ok: !!s.guesses[id]?.ok,
              action: { type: 'TOGGLE', playerId: id } })),
            sub: '틀렸지만 인정하고 싶으면 눌러서 정답 인정!',
            buttons: [{ label: s.round + 1 >= R ? '점수 반영하고 끝내기' : '점수 반영, 다음 출제자', action: { type: 'SCORE' } }],
          },
        };
      case 'final': {
        const res = result(s);
        return {
          key: 'final', screen: 'result', undo: true,
          props: { caption: res.caption, tone: res.tone, lines: [{ label: '라운드', value: `${R}판` }], points: res.points },
        };
      }
    }
    return { key: 'none', screen: 'talk', props: {} };
  },

  result,

  roles(s) { return { leader: s.rounds[0].writerId }; },
};

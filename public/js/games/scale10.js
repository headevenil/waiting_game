// 1부터 10까지 (Top Ten-style)
import { len } from '../i18n/norm.js';
import { draw } from '../content.js';
import { rng, shuffle, rotateAfter, othersAfter, roundsFor, withDefaults, nameOf, roundsOption } from './common.js';

const HEARTS = 8;
const MEMO_MAX = 12;
const OPTIONS = { rounds: roundsOption('선장') };

const rd = (s) => s.rounds[s.round];

// Count cards smaller than one already revealed above them.
export function mistakes(order, numbers) {
  let max = 0, wrong = 0;
  const flags = order.map((id) => {
    const n = numbers[id];
    const bad = n < max;
    if (bad) wrong++; else max = n;
    return bad;
  });
  return { wrong, flags };
}

function result(s) {
  if (s.phase !== 'final') return null;
  return s.hearts > 0
    ? { caption: '팀 승리!', tone: 'good', points: {}, team: { score: s.hearts, max: HEARTS } }
    : { caption: '아쉽다! 다시 도전', tone: 'bad', points: {}, team: { score: 0, max: HEARTS } };
}

export default {
  id: 'scale10',
  title: '1부터 10까지',
  rules: ['선장 빼고 모두 비밀 숫자(1~10)를 받아요.', '주제에 맞춰, 내 숫자만큼의 강도로 대답해요.', '선장이 작은 수부터 순서대로 맞히면 성공!'],
  sides: [{ team: '모두 한 팀', who: '선장 포함', goal: '순서를 맞혀 하트 8개를 지켜요' }],
  players: { min: 4, max: 6, best: 5 },
  minutes: [10, 15],
  options: OPTIONS,

  init({ players, options, content, seed, fairness }) {
    const o = withDefaults(options, OPTIONS);
    const r = rng(seed);
    const R = roundsFor(o.rounds, players);
    const leaders = rotateAfter(players, fairness?.lastLeader?.scale10);
    const themes = draw(r, content.scales, R, content.recent?.scales);
    const rounds = themes.map((t, i) => {
      const captainId = leaders[i % leaders.length];
      const answerers = othersAfter(players, captainId);
      const nums = shuffle(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);   // drawn without repeats: no ties
      return { captainId, scale: t, answerers, numbers: Object.fromEntries(answerers.map((id, j) => [id, nums[j]])) };
    });
    return {
      phase: 'theme', players, round: 0, rounds, turn: 0, memos: {}, order: null, flags: [], wrong: 0,
      hearts: HEARTS, perfect: 0,
      rng: r.seed(), used: { scales: themes.map((t) => t.id) },
    };
  },

  reduce(s, a) {
    switch (s.phase) {
      case 'theme':
        if (a.type === 'DEAL') return { ...s, phase: 'deal', turn: 0 };
        break;
      case 'deal':
        if (a.type === 'PEEKED' && a.playerId === rd(s).answerers[s.turn]) {
          const turn = s.turn + 1;
          return turn < rd(s).answerers.length ? { ...s, turn } : { ...s, turn, phase: 'answer' };
        }
        break;
      case 'answer':
        if (a.type === 'MEMO' && rd(s).answerers.includes(a.playerId)) {
          const text = String(a.text ?? '').trim();
          if (len(text) > MEMO_MAX) return s;
          return { ...s, memos: { ...s.memos, [a.playerId]: text } };
        }
        if (a.type === 'SORT') return { ...s, phase: 'sort' };
        break;
      case 'sort': {
        const ids = rd(s).answerers;
        if (a.type === 'BACK') return { ...s, phase: 'answer' };
        if (a.type !== 'LOCK' || !Array.isArray(a.order) || a.order.length !== ids.length || !ids.every((id) => a.order.includes(id))) break;
        const { wrong, flags } = mistakes(a.order, rd(s).numbers);
        return { ...s, phase: 'reveal', order: a.order.slice(), flags, wrong, hearts: Math.max(0, s.hearts - wrong), perfect: s.perfect + (wrong ? 0 : 1) };
      }
      case 'reveal':
        if (a.type === 'NEXT') {
          const round = s.round + 1;
          const base = { ...s, turn: 0, memos: {}, order: null, flags: [], wrong: 0 };
          if (s.hearts <= 0 || round >= s.rounds.length) return { ...base, phase: 'final' };
          return { ...base, round, phase: 'theme' };
        }
        break;
    }
    return s;
  },

  view(s) {
    const name = (id) => nameOf(s, id);
    const R = s.rounds.length;
    const round = `${s.round + 1}/${R}`;
    const { captainId, scale, answerers, numbers } = rd(s);
    const themeInfo = { theme: scale.theme, low: scale.low, high: scale.high };
    const cards = (order) => order.map((id) => ({ playerId: id, memo: s.memos[id] ?? '' }));
    switch (s.phase) {
      case 'theme':
        return {
          key: `theme:${s.round}`, round, screen: 'talk',
          props: {
            info: `선장: ${name(captainId)}`, hearts: s.hearts,
            label: '이번 주제', big: scale.theme, small: true,
            sub: `1 = ${scale.low} · 10 = ${scale.high}`,
            buttons: [{ label: '숫자 나눠 주기', action: { type: 'DEAL' } }],
          },
        };
      case 'deal': {
        const id = answerers[s.turn];
        return {
          key: `deal:${s.round}:${id}`, round, gate: { playerId: id, note: `선장(${name(captainId)})은 보지 마세요` },
          screen: 'hold',
          props: {
            secret: { top: scale.theme, number: numbers[id], low: scale.low, high: scale.high },
            confirm: { label: '확인했어요', action: { type: 'PEEKED', playerId: id } },
          },
        };
      }
      case 'answer':
        return {
          key: `answer:${s.round}`, round, screen: 'memo',
          props: {
            ...themeInfo, info: `선장: ${name(captainId)}`, hearts: s.hearts,
            sub: '순서대로 한 명씩 대답해요. 선장은 카드를 눌러 메모해요.',
            cards: cards(answerers), maxLength: MEMO_MAX, memoAction: { type: 'MEMO' },
            buttons: [{ label: '순서 맞히기', action: { type: 'SORT' } }],
          },
        };
      case 'sort':
        return {
          key: `sort:${s.round}`, round, screen: 'sorter',
          props: {
            ...themeInfo, info: `선장: ${name(captainId)}`,
            cards: cards(answerers), action: { type: 'LOCK' },
            back: { label: '대답 다시 듣기', action: { type: 'BACK' } },
          },
        };
      case 'reveal': {
        const caption = s.wrong === 0 ? '완벽한 선장!' : s.hearts <= 0 ? '하트가 다 떨어졌어!' : '아깝다~';
        return {
          key: `reveal:${s.round}`, round, screen: 'sorted', undo: true,
          props: {
            ...themeInfo, hearts: s.hearts, lost: s.wrong,
            cards: s.order.map((id, i) => ({ playerId: id, memo: s.memos[id] ?? '', number: numbers[id], bad: s.flags[i] })),
            caption, tone: s.wrong ? 'bad' : 'good',
            buttons: [{ label: s.hearts <= 0 || s.round + 1 >= R ? '결과 보기' : '다음 라운드', action: { type: 'NEXT' } }],
          },
        };
      }
      case 'final': {
        const res = result(s);
        return {
          key: 'final', screen: 'result', undo: true,
          props: {
            caption: res.caption, tone: res.tone, hearts: s.hearts,
            lines: [{ label: '남은 하트', value: `${s.hearts} / ${HEARTS}` }, { label: '완벽한 라운드', value: `${s.perfect}번` }],
          },
        };
      }
    }
    return { key: 'none', screen: 'talk', props: {} };
  },

  result,

  roles(s) { return { leader: s.rounds[0].captainId }; },
};

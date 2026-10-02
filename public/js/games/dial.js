// 마음 다이얼 (Wavelength-style)
import { josa } from '../i18n/josa.js';
import { draw } from '../content.js';
import { rng, int, rotateAfter, roundsFor, withDefaults, nameOf, roundsOption } from './common.js';

const OPTIONS = { rounds: roundsOption('출제자') };

// Distance on 0–100 → points and caption.
export const ZONES = [
  { max: 4, points: 4, caption: '과녁 정중앙!' },
  { max: 12, points: 3, caption: '거의 다 왔다!' },
  { max: 20, points: 2, caption: '나쁘지 않아' },
  { max: Infinity, points: 0, caption: '텔레파시 실패' },
];
export const scoreFor = (needle, target) => ZONES.find((z) => Math.abs(needle - target) <= z.max);

const rd = (s) => s.rounds[s.round];

function finalCaption(total, R) {
  const max = R * 4;
  if (total >= max * 0.8) return '이심전심';
  if (total >= max * 0.6) return '찰떡궁합';
  return '다음엔 텔레파시!';
}

function result(s) {
  if (s.phase !== 'final') return null;
  const R = s.rounds.length;
  return { caption: finalCaption(s.total, R), tone: s.total >= R * 4 * 0.6 ? 'good' : 'neutral', points: {}, team: { score: s.total, max: R * 4 } };
}

export default {
  id: 'dial',
  title: '마음 다이얼',
  rules: ['출제자만 과녁 위치를 봐요.', '양 끝 단어 사이, 과녁 자리에 맞는 힌트를 말해요.', '다 같이 상의해서 바늘을 돌려요. 가까울수록 높은 점수!'],
  sides: [{ team: '모두 한 팀', who: '출제자 포함', goal: '바늘을 과녁에 맞혀 팀 점수를 모아요' }],
  players: { min: 4, max: 6, best: 5 },
  minutes: [10, 15],
  options: OPTIONS,

  init({ players, options, content, seed, fairness }) {
    const o = withDefaults(options, OPTIONS);
    const r = rng(seed);
    const R = roundsFor(o.rounds, players);
    const leaders = rotateAfter(players, fairness?.lastLeader?.dial);
    const specs = draw(r, content.spectrums, R, content.recent?.spectrums);
    const rounds = specs.map((sp, i) => ({ setterId: leaders[i % leaders.length], spectrum: sp, target: int(r, 101) }));
    return {
      phase: 'peek', players, round: 0, rounds, clue: '', needle: null, points: 0, total: 0, results: [],
      rng: r.seed(), used: { spectrums: specs.map((x) => x.id) },
    };
  },

  reduce(s, a) {
    switch (s.phase) {
      case 'peek':
        if (a.type === 'PEEKED' && a.playerId === rd(s).setterId) return { ...s, phase: 'clue' };
        break;
      case 'clue':
        if (a.type === 'TUNE') return { ...s, phase: 'tune', clue: String(a.text ?? '').trim().slice(0, 30) };
        break;
      case 'tune': {
        const v = Number(a.value);
        if (a.type !== 'LOCK' || !Number.isFinite(v)) break;
        const needle = Math.max(0, Math.min(100, Math.round(v)));
        const { points } = scoreFor(needle, rd(s).target);
        return { ...s, phase: 'reveal', needle, points, total: s.total + points, results: [...s.results, points] };
      }
      case 'reveal':
        if (a.type === 'NEXT') {
          const round = s.round + 1;
          const base = { ...s, clue: '', needle: null, points: 0 };
          return round >= s.rounds.length ? { ...base, phase: 'final' } : { ...base, round, phase: 'peek' };
        }
        break;
    }
    return s;
  },

  view(s) {
    const name = (id) => nameOf(s, id);
    const R = s.rounds.length;
    const round = `${s.round + 1}/${R}`;
    const { setterId, spectrum, target } = rd(s);
    const ends = { left: spectrum.left, right: spectrum.right };
    switch (s.phase) {
      case 'peek':
        return {
          key: `peek:${s.round}`, round, gate: { playerId: setterId, note: '출제자만 보세요' }, screen: 'hold',
          props: {
            secret: { top: '과녁 위치', dial: { ...ends, target } },
            confirm: { label: '확인했어요', action: { type: 'PEEKED', playerId: setterId } },
          },
        };
      case 'clue':
        return {
          key: `clue:${s.round}`, round, screen: 'clue',
          props: {
            ...ends, info: `점수 ${s.total}`,
            label: '출제자', big: name(setterId), bigPlayer: setterId,
            sub: `${josa(name(setterId), '이/가')} 힌트를 소리 내어 말해요.`,
            placeholder: '힌트 적어두기 (선택)',
            action: { type: 'TUNE' },
            submitLabel: '힌트 말했어요',
          },
        };
      case 'tune':
        return {
          key: `tune:${s.round}`, round, screen: 'dial',
          props: {
            mode: 'tune', ...ends, clue: s.clue, info: `점수 ${s.total}`,
            sub: `다 같이 상의해서 바늘을 돌려요. ${josa(name(setterId), '은/는')} 조용히!`,
            action: { type: 'LOCK' },
          },
        };
      case 'reveal': {
        const z = scoreFor(s.needle, target);
        return {
          key: `reveal:${s.round}`, round, screen: 'dial', undo: true,
          props: {
            mode: 'reveal', ...ends, clue: s.clue, needle: s.needle, target,
            caption: z.caption, tone: z.points >= 3 ? 'good' : z.points ? 'neutral' : 'bad',
            sub: `+${z.points}점 · 합계 ${s.total}점`,
            buttons: [{ label: s.round + 1 >= R ? '결과 보기' : '다음 라운드', action: { type: 'NEXT' } }],
          },
        };
      }
      case 'final': {
        const res = result(s);
        return {
          key: 'final', screen: 'result', undo: true,
          props: { caption: res.caption, tone: res.tone, big: `${s.total}점`,
            lines: [{ label: '팀 점수', value: `${s.total} / ${R * 4}` }, { label: '라운드별', value: s.results.join(' · ') }] },
        };
      }
    }
    return { key: 'none', screen: 'talk', props: {} };
  },

  result,

  roles(s) { return { leader: s.rounds[0].setterId }; },
};

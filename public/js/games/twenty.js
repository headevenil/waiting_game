// 숨은 조력자 스무고개 (Insider-style)
import { josa } from '../i18n/josa.js';
import { draw } from '../content.js';
import { rng, rotateAfter, fewest, withDefaults, timerStart, timerLeft, timerReduce, nameOf } from './common.js';

const OPTIONS = {
  time: {
    label: '제한 시간',
    choices: [{ value: 180, label: '3분' }, { value: 240, label: '4분' }, { value: 300, label: '5분' }],
    default: 240,
  },
};
const MIN_DISCUSS = 30;

function secretFor(s, id) {
  const team = '진행자 + 일반 참가자 한 편';
  if (id === s.hostId) return { top: '당신은 진행자', big: s.word, bottom: '예 / 아니오 / 몰라요로만 답해요', side: team };
  if (id === s.helperId) return { top: '당신은 숨은 조력자', big: s.word, bottom: '들키지 않게 정답 쪽으로 이끌어요', side: '나 혼자 한 편' };
  return { top: '당신은 일반 참가자', big: '???', bottom: '질문으로 정답을 맞혀요', side: team };
}

function result(s) {
  if (s.phase !== 'result') return null;
  if (s.outcome === 'timeout') return { caption: '시간 초과!', tone: 'bad', points: {} };
  if (s.outcome === 'caught') {
    const points = {};
    for (const p of s.players) if (p.id !== s.helperId) points[p.id] = 1;
    return { caption: '조력자 검거!', tone: 'good', points };
  }
  return { caption: '조력자 승리!', tone: 'bad', points: { [s.helperId]: 3 } };
}

export default {
  id: 'twenty',
  title: '숨은 조력자 스무고개',
  rules: ['진행자와 숨은 조력자만 정답을 알아요.', '모두 진행자에게 예/아니오 질문! 제한 시간 4분.', '정답을 맞히면, 이제 숨은 조력자를 찾아요!'],
  sides: [
    { team: '진행자 팀', who: '진행자 + 일반 참가자', goal: '정답을 찾고, 숨은 조력자를 잡아요' },
    { team: '숨은 조력자', who: '혼자', goal: '정답으로 몰래 이끌고, 끝까지 안 들켜요' },
  ],
  sidesNote: '시간 안에 정답을 못 찾으면 조력자까지 모두 져요.',
  players: { min: 4, max: 6, best: 5 },
  minutes: [5, 7],
  options: OPTIONS,

  init({ players, options, content, seed, fairness }) {
    const o = withDefaults(options, OPTIONS);
    const r = rng(seed);
    const hostId = rotateAfter(players, fairness?.lastLeader?.twenty)[0];
    const helperId = fewest(r, players.map((p) => p.id).filter((id) => id !== hostId), fairness?.helper);
    const pool = content.words.filter((w) => w.yesno && w.diff <= 2);
    const [w] = draw(r, pool.length ? pool : content.words, 1, content.recent?.words);
    return {
      phase: 'reveal', players, hostId, helperId, word: w.text, wordId: w.id,
      limit: Number(o.time) || 240, turn: 0, timer: null, elapsed: 0,
      guesserId: null, accusedId: null, outcome: null,
      rng: r.seed(), used: { words: [w.id] },
    };
  },

  reduce(s, a) {
    const t = timerReduce(s, a);
    if (t) return t;
    switch (s.phase) {
      case 'reveal':
        if (a.type === 'PEEKED' && a.playerId === s.players[s.turn]?.id) {
          const turn = s.turn + 1;
          return turn < s.players.length ? { ...s, turn } : { ...s, turn, phase: 'ready' };
        }
        break;
      case 'ready':
        if (a.type === 'START') return { ...s, phase: 'questions', timer: timerStart(s.limit, a.now ?? 0) };
        break;
      case 'questions':
        if (a.type === 'FOUND') {
          const elapsed = Math.round((s.limit * 1000 - timerLeft(s.timer, a.now ?? 0)) / 1000);
          return { ...s, phase: 'whoGuessed', timer: null, elapsed: Math.max(0, Math.min(s.limit, elapsed)) };
        }
        if (a.type === 'TICK' && timerLeft(s.timer, a.now ?? 0) <= 0) return { ...s, phase: 'result', timer: null, outcome: 'timeout' };
        break;
      case 'whoGuessed':
        if (a.type === 'GUESSED' && a.playerId !== s.hostId && s.players.some((p) => p.id === a.playerId)) {
          return { ...s, phase: 'discuss', guesserId: a.playerId, timer: timerStart(Math.max(MIN_DISCUSS, s.elapsed), a.now ?? 0) };
        }
        break;
      case 'discuss':
        if (a.type === 'START_VOTE') return { ...s, phase: 'vote', timer: null };
        break;
      case 'vote':
        if (a.type === 'ACCUSE' && a.playerId !== s.hostId && s.players.some((p) => p.id === a.playerId)) {
          return { ...s, phase: 'result', accusedId: a.playerId, outcome: a.playerId === s.helperId ? 'caught' : 'escaped' };
        }
        break;
    }
    return s;
  },

  view(s) {
    const name = (id) => nameOf(s, id);
    const others = s.players.map((p) => p.id).filter((id) => id !== s.hostId);
    switch (s.phase) {
      case 'reveal': {
        const p = s.players[s.turn];
        return {
          key: `reveal:${p.id}`, round: `${s.turn + 1}/${s.players.length}`, gate: { playerId: p.id }, screen: 'hold',
          props: { secret: secretFor(s, p.id), confirm: { label: '확인했어요', action: { type: 'PEEKED', playerId: p.id } } },
        };
      }
      case 'ready':
        return {
          key: 'ready', screen: 'talk',
          props: {
            label: '진행자', big: name(s.hostId), bigPlayer: s.hostId,
            sub: `진행자에게 폰을 주세요. 시작하면 ${s.limit / 60}분 타이머가 돌아가요.`,
            buttons: [{ label: '시작!', action: { type: 'START' } }],
          },
        };
      case 'questions':
        return {
          key: 'questions', screen: 'talk',
          props: {
            info: `진행자: ${name(s.hostId)}`,
            timer: s.timer, timerExpire: { type: 'TICK' },
            label: '진행자에게 질문!',
            big: '예 · 아니오 · 몰라요',
            sub: '정답이 나오면 바로 눌러요.',
            peek: { label: '단어 다시 보기 (꾹)', secret: { top: '제시어', big: s.word } },
            buttons: [{ label: '정답 나왔다!', action: { type: 'FOUND' }, kind: 'good' }],
          },
        };
      case 'whoGuessed':
        return {
          key: 'whoGuessed', screen: 'pickPlayer', undo: true,
          props: { title: '누가 맞혔나요?', sub: `걸린 시간 ${Math.floor(s.elapsed / 60)}:${String(s.elapsed % 60).padStart(2, '0')}`,
            candidates: others, action: { type: 'GUESSED' } },
        };
      case 'discuss':
        return {
          key: 'discuss', screen: 'talk', undo: true,
          props: {
            info: `정답: ${s.word}`,
            timer: s.timer,
            label: '맞힌 사람',
            big: name(s.guesserId), bigPlayer: s.guesserId,
            sub: '숨은 조력자는 누구? 너무 잘 이끈 사람이 수상해요.',
            buttons: [{ label: '투표하기', action: { type: 'START_VOTE' } }],
          },
        };
      case 'vote':
        return {
          key: 'vote', screen: 'vote', undo: true,
          props: {
            title: '숨은 조력자는 누구?',
            sub: `하나, 둘, 셋에 가리키고, 지목된 사람을 눌러요. 동점이면 ${josa(name(s.hostId), '이/가')} 골라요.`,
            candidates: others, highlight: s.guesserId, action: { type: 'ACCUSE' },
          },
        };
      case 'result': {
        const res = result(s);
        const lines = [{ label: '제시어', value: s.word }, { label: '숨은 조력자', value: name(s.helperId), playerId: s.helperId }];
        if (s.guesserId) lines.push({ label: '맞힌 사람', value: name(s.guesserId), playerId: s.guesserId });
        return { key: 'result', screen: 'result', undo: true, props: { caption: res.caption, tone: res.tone, lines, points: res.points } };
      }
    }
    return { key: 'none', screen: 'talk', props: {} };
  },

  result,

  roles(s) { return { secret: { role: 'helper', id: s.helperId }, leader: s.hostId }; },
};

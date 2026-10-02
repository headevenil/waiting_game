// 라이어 찾기 (Odd One Out)
import { josa } from '../i18n/josa.js';
import { draw } from '../content.js';
import { rng, int, pick, shuffle, fewest, withDefaults, timerStart, timerReduce, nameOf } from './common.js';

const OPTIONS = {
  mode: { label: '모드', choices: ['일반', '바보'], default: '일반' },
  topic: { label: '주제', choices: 'content:categories', default: '랜덤' },
  timer: {
    label: '토론 시간',
    choices: [{ value: 0, label: '없음' }, { value: 120, label: '2분' }, { value: 180, label: '3분' }, { value: 300, label: '5분' }],
    default: 180,
  },
};

function startDescribe(s, now) {
  return { ...s, phase: 'describe', speaker: 0, timer: s.timerSec ? timerStart(s.timerSec, now ?? 0) : null };
}

function secretFor(s, id) {
  const isLiar = id === s.liarId;
  const top = `주제: ${s.topic}`;
  // 바보 모드 liars get the 시민 screen, side line included: they don't know yet.
  if (isLiar && s.mode === '일반') return { top, big: '당신은 라이어예요', bottom: '들키지 말고 제시어를 알아내요', side: '나 혼자 한 편' };
  return { top, big: isLiar ? s.decoy : s.word, bottom: '한 문장으로 설명해요', side: '라이어 빼고 모두 한 편' };
}

function result(s) {
  if (s.phase !== 'result') return null;
  if (s.outcome === 'caught') {
    const points = {};
    for (const p of s.players) if (p.id !== s.liarId) points[p.id] = 1;
    return { caption: '라이어 검거!', tone: 'good', points };
  }
  if (s.outcome === 'stolen') return { caption: '역전승!', tone: 'bad', points: { [s.liarId]: 2 } };
  return { caption: '라이어 승리!', tone: 'bad', points: { [s.liarId]: 3 } };
}

export default {
  id: 'liar',
  title: '라이어 찾기',
  rules: ['라이어만 제시어를 몰라요.', '한 명씩 돌아가며 제시어를 한 문장으로 설명해요.',
    '라이어를 찾으면 시민 승! 라이어가 제시어를 맞히면 역전!'],
  sides: [
    { team: '시민 팀', who: '라이어 빼고 모두', goal: '라이어를 찾아내요' },
    { team: '라이어', who: '혼자', goal: '끝까지 숨거나, 들켜도 제시어를 맞혀요' },
  ],
  sidesNote: '바보 모드에서는 라이어도 자기가 시민인 줄 알아요.',
  players: { min: 4, max: 6, best: 5 },
  minutes: [3, 5],
  options: OPTIONS,

  init({ players, options, content, seed, fairness }) {
    const o = withDefaults(options, OPTIONS);
    const r = rng(seed);
    const words = content.words.filter((w) => o.mode !== '바보' || w.decoy);
    const counts = {};
    for (const w of words) counts[w.cat] = (counts[w.cat] ?? 0) + 1;
    const cats = Object.keys(counts).filter((c) => counts[c] >= 3);
    const topic = cats.includes(o.topic) ? o.topic : pick(r, cats.length ? cats : Object.keys(counts));
    const [w] = draw(r, words.filter((x) => x.cat === topic), 1, content.recent?.words);
    const ids = players.map((p) => p.id);
    const liarId = fewest(r, ids, fairness?.liar);
    const order = shuffle(r, ids);
    if (order[0] === liarId) {                       // the liar never speaks first
      const j = 1 + int(r, order.length - 1);
      [order[0], order[j]] = [order[j], order[0]];
    }
    return {
      phase: 'reveal', players, mode: o.mode, timerSec: Number(o.timer) || 0,
      topic, word: w.text, wordId: w.id, decoy: w.decoy ?? null,
      liarId, order, turn: 0, speaker: 0, laps: 1, timer: null,
      vote: { round: 1, candidates: ids }, accusedId: null, repeekId: null, outcome: null,
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
          return turn < s.players.length ? { ...s, turn } : startDescribe({ ...s, turn }, a.now);
        }
        break;
      case 'describe':
        if (a.type === 'NEXT_SPEAKER' && s.speaker < s.order.length) return { ...s, speaker: s.speaker + 1 };
        if (a.type === 'MORE_ROUND') return { ...s, speaker: 0, laps: s.laps + 1 };
        if (a.type === 'REPEEK') return { ...s, phase: 'repeekPick' };
        if (a.type === 'START_VOTE') return { ...s, phase: 'vote', timer: null, vote: { round: 1, candidates: s.players.map((p) => p.id) } };
        break;
      case 'repeekPick':
        if (a.type === 'REPEEK_PICK' && s.players.some((p) => p.id === a.playerId)) return { ...s, phase: 'repeek', repeekId: a.playerId };
        if (a.type === 'CANCEL') return { ...s, phase: 'describe' };
        break;
      case 'repeek':
        if (a.type === 'PEEKED' && a.playerId === s.repeekId) return { ...s, phase: 'describe', repeekId: null };
        break;
      case 'vote':
        if (a.type === 'ACCUSE' && s.vote.candidates.includes(a.playerId)) {
          return a.playerId === s.liarId
            ? { ...s, phase: 'lastChance', accusedId: a.playerId }
            : { ...s, phase: 'result', accusedId: a.playerId, outcome: 'escaped' };
        }
        if (a.type === 'TIE') {
          if (s.vote.round >= 2) return { ...s, phase: 'result', accusedId: null, outcome: 'escaped' };
          const tied = (a.playerIds ?? []).filter((id) => s.vote.candidates.includes(id));
          if (tied.length < 2) return s;
          return { ...s, vote: { round: 2, candidates: tied } };
        }
        break;
      case 'lastChance':
        if (a.type === 'LIAR_GUESS') return { ...s, phase: 'result', outcome: a.correct ? 'stolen' : 'caught' };
        break;
    }
    return s;
  },

  view(s) {
    const n = s.players.length;
    const name = (id) => nameOf(s, id);
    switch (s.phase) {
      case 'reveal': {
        const p = s.players[s.turn];
        return {
          key: `reveal:${p.id}`, gate: { playerId: p.id }, round: `${s.turn + 1}/${n}`,
          screen: 'hold',
          props: { secret: secretFor(s, p.id), confirm: { label: '확인했어요', action: { type: 'PEEKED', playerId: p.id } } },
        };
      }
      case 'repeek':
        return {
          key: `repeek:${s.repeekId}`, gate: { playerId: s.repeekId }, screen: 'hold',
          props: { secret: secretFor(s, s.repeekId), confirm: { label: '확인했어요', action: { type: 'PEEKED', playerId: s.repeekId } } },
        };
      case 'repeekPick':
        return {
          key: 'repeekPick', screen: 'pickPlayer',
          props: { title: '누가 다시 볼까요?', sub: '모두 같은 버튼을 봐요. 물어봐도 티 안 나요.', candidates: s.players.map((p) => p.id),
            action: { type: 'REPEEK_PICK' }, cancel: { label: '취소', action: { type: 'CANCEL' } } },
        };
      case 'describe': {
        const done = s.speaker >= s.order.length;
        const nextIds = s.order.slice(s.speaker + 1);
        return {
          key: 'describe', round: s.laps > 1 ? `${s.laps}바퀴` : '',
          screen: 'talk',
          props: {
            info: `주제: ${s.topic}`,
            timer: s.timer,
            label: done ? '' : '지금 말할 사람',
            big: done ? '한 바퀴 끝!' : name(s.order[s.speaker]),
            bigPlayer: done ? null : s.order[s.speaker],
            sub: done ? '한 바퀴 더 돌까요, 투표할까요?' : nextIds.length ? `다음: ${nextIds.map(name).join(' → ')}` : '마지막 사람이에요',
            buttons: [
              ...(done ? [] : [{ label: '다음 사람', action: { type: 'NEXT_SPEAKER' } }]),
              { label: '한 바퀴 더', action: { type: 'MORE_ROUND' }, kind: 'secondary' },
              { label: '투표하기', action: { type: 'START_VOTE' }, kind: done ? 'primary' : 'secondary' },
            ],
            extra: [{ label: '제시어 다시 보기', action: { type: 'REPEEK' } }],
          },
        };
      }
      case 'vote':
        return {
          key: `vote:${s.vote.round}`, screen: 'vote', undo: true,
          props: {
            title: s.vote.round === 1 ? '라이어는 누구?' : '동점! 다시 투표',
            sub: '하나, 둘, 셋에 다 같이 가리키고, 지목된 사람을 눌러요.',
            candidates: s.vote.candidates,
            action: { type: 'ACCUSE' },
            tie: s.vote.round === 1
              ? { label: '동점이에요', select: true, action: { type: 'TIE' } }
              : { label: '또 동점이에요 (라이어 승리)', select: false, action: { type: 'TIE' } },
          },
        };
      case 'lastChance':
        return {
          key: 'lastChance', screen: 'talk', undo: true,
          props: {
            label: '라이어 발견!',
            big: name(s.liarId), bigPlayer: s.liarId,
            sub: `마지막 기회! ${josa(name(s.liarId), '이/가')} 제시어를 맞히면 역전이에요.`,
            buttons: [
              { label: '맞음', action: { type: 'LIAR_GUESS', correct: true }, kind: 'good' },
              { label: '틀림', action: { type: 'LIAR_GUESS', correct: false }, kind: 'bad' },
            ],
          },
        };
      case 'result': {
        const res = result(s);
        const lines = [{ label: '제시어', value: s.word }, { label: '라이어', value: name(s.liarId), playerId: s.liarId }];
        if (s.mode === '바보') lines.push({ label: '라이어의 단어', value: s.decoy });
        if (s.outcome === 'escaped' && s.accusedId) lines.push({ label: '지목된 사람', value: name(s.accusedId), playerId: s.accusedId });
        return { key: 'result', screen: 'result', undo: true, props: { caption: res.caption, tone: res.tone, lines, points: res.points } };
      }
    }
    return { key: 'none', screen: 'talk', props: {} };
  },

  result,

  roles(s) { return { secret: { role: 'liar', id: s.liarId } }; },
};

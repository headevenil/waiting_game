// Pure helpers shared by the six game reducers. No DOM, no Date.now(), no Math.random().
import { makeRng } from '../rng.js';
import { josa } from '../i18n/josa.js';

export const rng = makeRng;
export const int = (r, n) => Math.floor(r() * n);
export const pick = (r, arr) => arr[int(r, arr.length)];

export function shuffle(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(r, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fair rotation for secret roles: fewest past turns wins, RNG breaks ties.
export function fewest(r, ids, counts = {}) {
  const c = (id) => counts?.[id] ?? 0;
  const min = Math.min(...ids.map(c));
  return pick(r, ids.filter((id) => c(id) === min));
}

// Leader roles rotate in roster order, starting after whoever led last.
export function rotateAfter(players, lastId) {
  const ids = players.map((p) => p.id);
  const i = ids.indexOf(lastId);
  return i < 0 ? ids : [...ids.slice(i + 1), ...ids.slice(0, i + 1)];
}

// Everyone except `id`, in roster order starting after `id`.
export const othersAfter = (players, id) => rotateAfter(players, id).filter((x) => x !== id);

export function withDefaults(options = {}, spec = {}) {
  const o = {};
  for (const [k, v] of Object.entries(spec)) o[k] = options[k] ?? v.default;
  return o;
}

// 0 ("모두 한 번씩") means one round per player.
export const roundsFor = (opt, players) => (Number(opt) > 0 ? Number(opt) : players.length);

export const nameOf = (s, id) => s.players.find((p) => p.id === id)?.name ?? '';
// 판 수. 0 = everyone leads once; the rules screen shows it as "모두 한 번씩 (N판)".
export const roundsOption = (leader) => ({
  label: '판 수',
  choices: [{ value: 0, label: '모두 한 번씩', perPlayer: true }, { value: 3, label: '3판' }, { value: 1, label: '1판' }],
  default: 0,
  note: `판마다 ${josa(leader, '이/가')} 바뀌어요. '모두 한 번씩'이면 모두가 ${josa(leader, '을/를')} 한 번씩 맡아요.`,
});

// Timers store a deadline while running, or `remaining` (ms) while paused.
export const timerStart = (sec, now = 0) => ({ total: sec, deadline: now + sec * 1000, remaining: null });
export const timerLeft = (t, now = 0) => (!t ? 0 : t.remaining != null ? t.remaining : Math.max(0, t.deadline - now));
export const timerRunning = (t) => !!t && t.remaining == null;
export const timerPause = (t, now) => (timerRunning(t) ? { ...t, remaining: timerLeft(t, now), deadline: null } : t);
export const timerResume = (t, now = 0) => (t && t.remaining != null ? { ...t, deadline: now + t.remaining, remaining: null } : t);
export function timerAdd(t, sec, now = 0) {
  if (!t) return t;
  const total = t.total + sec;
  return t.remaining != null
    ? { ...t, total, remaining: t.remaining + sec * 1000 }
    : { ...t, total, deadline: Math.max(t.deadline, now) + sec * 1000 };
}

// Generic TIMER_* handling for state.timer; returns null when the action isn't a timer action.
export function timerReduce(s, a) {
  if (!s.timer) return null;
  switch (a.type) {
    case 'TIMER_PAUSE': return timerRunning(s.timer) ? { ...s, timer: timerPause(s.timer, a.now) } : s;
    case 'TIMER_RESUME': return timerRunning(s.timer) ? s : { ...s, timer: timerResume(s.timer, a.now) };
    case 'TIMER_ADD': return { ...s, timer: timerAdd(s.timer, a.sec ?? 30, a.now) };
    default: return null;
  }
}

// Sum point maps, dropping zeros.
export function addPoints(...maps) {
  const out = {};
  for (const m of maps) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] ?? 0) + v;
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

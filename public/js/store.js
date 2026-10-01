// Single source of truth. Saved to localStorage after every action; 10-step undo for game actions.
import { remember } from './content.js';

export const STORAGE_KEY = 'wg:v1';
export const SCHEMA = 1;
const UNDO_MAX = 10;

export const COLORS = ['yellow', 'orange', 'sky', 'green', 'pink', 'purple'];

const pad = (n) => String(n).padStart(2, '0');
function dayId(ms) {
  const d = new Date(ms);
  return `s_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export const newSession = (ms) => ({ id: dayId(ms), scores: {}, rounds: [] });

export function defaults(ms = 0) {
  return {
    schema: SCHEMA,
    roster: [],
    settings: { theme: 'auto', haptics: true, timerDefaults: {}, gameOptions: {}, iosGuideSeen: false },
    session: newSession(ms),
    game: null,
    recent: { words: [], spectrums: [], scales: [] },
    fairness: { liar: {}, helper: {}, leader: {}, lastLeader: {} },
    bests: {},
  };
}

// Bring any saved shape up to the current schema; throws on unreadable data.
export function migrate(old) {
  if (!old || typeof old !== 'object') throw new Error('unreadable');
  let s = old;
  if ((s.schema ?? 0) === 0) {
    // schema 0 (early prototype): { players: [{ name }], scores: { [name]: n } }
    const roster = (s.players ?? []).map((p, i) => ({ id: `p${i + 1}`, name: String(p.name), color: COLORS[i % COLORS.length] }));
    const scores = {};
    for (const p of roster) if (s.scores?.[p.name]) scores[p.id] = s.scores[p.name];
    s = { schema: 1, roster, session: { ...newSession(0), scores } };
  }
  if (s.schema !== SCHEMA) throw new Error('unknown schema ' + s.schema);
  const d = defaults();
  return {
    ...d,
    ...s,
    settings: { ...d.settings, ...s.settings },
    session: { ...d.session, ...s.session },
    recent: { ...d.recent, ...s.recent },
    fairness: { ...d.fairness, ...s.fairness },
    bests: { ...s.bests },
  };
}

export function createStore({ storage, games = {}, getContent = () => ({ words: [], spectrums: [], scales: [] }),
  newSeed = () => 1, now = () => Date.now() } = {}) {
  let notice = null;
  let undoStack = [];
  const subs = new Set();
  let state = load();

  function load() {
    let raw = null;
    try { raw = storage?.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
    if (!raw) return defaults(now());
    try {
      const s = migrate(JSON.parse(raw));
      if (s.game && !games[s.game.id]) s.game = null;
      return s;
    } catch {
      notice = '저장된 데이터를 읽을 수 없어서 초기화했어요';
      return defaults(now());
    }
  }

  function save() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
  }

  function startGame(s, gameId, options = {}) {
    const mod = games[gameId];
    if (!mod) return s;
    const content = { ...getContent(s, gameId), recent: s.recent };
    const seed = newSeed();
    const gs = mod.init({ players: s.roster.map((p) => ({ ...p })), options, content, seed, fairness: s.fairness });
    const recent = { ...s.recent };
    for (const [k, ids] of Object.entries(gs.used ?? {})) recent[k] = remember(recent[k], ids);
    const fairness = { ...s.fairness, lastLeader: { ...s.fairness.lastLeader } };
    const roles = mod.roles?.(gs) ?? {};
    if (roles.secret) {
      const { role, id } = roles.secret;
      fairness[role] = { ...fairness[role], [id]: (fairness[role]?.[id] ?? 0) + 1 };
    }
    if (roles.leader) {
      fairness.leader = { ...fairness.leader, [roles.leader]: (fairness.leader?.[roles.leader] ?? 0) + 1 };
      fairness.lastLeader[gameId] = roles.leader;
    }
    return {
      ...s,
      recent,
      fairness,
      settings: { ...s.settings, gameOptions: { ...s.settings.gameOptions, [gameId]: options } },
      game: { id: gameId, uid: `${seed}-${s.session.rounds.length}`, options, state: gs, recorded: false },
    };
  }

  // Add a finished game's points to the session exactly once.
  function record(s, mod, at) {
    const res = mod.result(s.game.state);
    if (!res || s.game.recorded) return s;
    const scores = { ...s.session.scores };
    for (const [id, n] of Object.entries(res.points ?? {})) scores[id] = (scores[id] ?? 0) + n;
    const bests = { ...s.bests };
    if (res.team) bests[s.game.id] = Math.max(bests[s.game.id] ?? 0, res.team.score);
    const rounds = [...s.session.rounds, { gameId: s.game.id, points: res.points ?? {}, team: res.team ?? null, at }].slice(-200);
    return { ...s, bests, session: { ...s.session, scores, rounds }, game: { ...s.game, recorded: true } };
  }

  function dispatch(action) {
    const prev = state;
    let next = state;
    switch (action.type) {
      case 'undo':
        if (!undoStack.length) return;
        next = undoStack.pop();
        break;
      case 'roster/set': {
        const roster = action.players.map((p) => ({ id: p.id, name: p.name.trim(), color: p.color }));
        next = { ...state, roster };
        break;
      }
      case 'settings/set':
        next = { ...state, settings: { ...state.settings, ...action.patch } };
        break;
      case 'session/reset':
        next = { ...state, session: newSession(now()) };
        break;
      case 'recent/clear':
        next = { ...state, recent: defaults().recent };
        break;
      case 'all/reset':
        next = defaults(now());
        undoStack = [];
        break;
      case 'game/start':
        next = startGame(state, action.gameId, action.options);
        undoStack = [];
        break;
      case 'game/again':
        if (!state.game) return;
        next = startGame(state, state.game.id, state.game.options);
        undoStack = [];
        break;
      case 'game/end':
        next = { ...state, game: null };
        undoStack = [];
        break;
      default: {
        if (!state.game) return;
        const mod = games[state.game.id];
        const gs = mod.reduce(state.game.state, action);
        if (gs === state.game.state) return;               // unknown or invalid action
        next = record({ ...state, game: { ...state.game, state: gs } }, mod, action.now ?? now());
        undoStack.push(prev);
        if (undoStack.length > UNDO_MAX) undoStack.shift();
      }
    }
    state = next;
    save();
    for (const fn of subs) fn(state, action);
  }

  return {
    get state() { return state; },
    dispatch,
    canUndo: () => undoStack.length > 0,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    takeNotice: () => { const n = notice; notice = null; return n; },
  };
}

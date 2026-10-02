// In-game host. Asks the game for view(state) and draws the matching shared component.
// It never knows game rules: buttons carry the plain action objects the view hands it.
import { h, btn, colorOf } from '../ui/h.js';
import { t } from '../i18n/ko.js';
import { gate, groupGate } from '../ui/gate.js';
import { hold } from '../ui/hold.js';
import { caption } from '../ui/caption.js';
import { timer } from '../ui/timer.js';
import { vote } from '../ui/vote.js';
import { koinput } from '../ui/koinput.js';
import { sorter, sortedList } from '../ui/sorter.js';
import { dial } from '../ui/dial.js';
import { sheet, closeSheet } from '../ui/sheet.js';
import { byId } from '../games/registry.js';
import { timerRunning } from '../games/common.js';
import { clueError } from '../games/kkwang.js';
import { writeError } from '../games/fading.js';
import { sidesBlock } from './rules.js';

// UI-only state. Never persisted, so a reload always lands back on the pass gate.
let passedGate = null;
let local = {};
let localUid = null;
const L = (key, init) => (local[key] ??= init());

const CHECKS = {
  clue: (v, c) => clueError(v, { text: c.answer, aliases: c.aliases ?? [] }),
  write: (v, c) => writeError(v, { text: c.answer, aliases: c.aliases ?? [] }),
};

export function currentView(store) {
  const g = store.state.game;
  if (!g || !byId[g.id]) return null;
  return byId[g.id].view(g.state);
}

// Leaving the page (visibilitychange → hidden) auto-pauses any running timer.
export function pauseIfRunning(store) {
  const v = currentView(store);
  if (v?.props?.timer && timerRunning(v.props.timer)) store.dispatch({ type: 'TIMER_PAUSE', now: Date.now() });
}

export function sessionScreen(ctx) {
  const { store } = ctx;
  const st = store.state;
  const mod = byId[st.game.id];
  const gs = st.game.state;
  if (localUid !== st.game.uid) { local = {}; localUid = st.game.uid; }
  const view = mod.view(gs);
  const key = `${st.game.uid}:${view.key}`;
  const players = Object.fromEntries(gs.players.map((p) => [p.id, p]));
  const act = (a, payload = {}) => store.dispatch({ ...a, ...payload, now: Date.now() });
  const c = { ...ctx, act, players, key, view, mod, res: mod.result(gs) };
  const top = topbar(c);

  if (view.gate && passedGate !== key) {
    const onConfirm = () => { passedGate = key; ctx.rerender(); };
    const g = view.gate;
    const node = g.group
      ? groupGate({ title: g.title, sub: g.sub, button: g.button, onConfirm })
      : gate({ player: players[g.playerId], note: g.note, onConfirm });
    return h('div', { class: 'screen is-gate' }, top, node);
  }
  const r = (SCREENS[view.screen] ?? SCREENS.talk)(view.props ?? {}, c);
  return h('div', { class: `screen screen-${view.screen}` }, top,
    h('main', { class: 'main', id: 'main' }, r.body),
    r.dock?.filter(Boolean).length ? h('footer', { class: 'dock' }, r.dock) : null);
}

function topbar(c) {
  const { store, view, mod } = c;
  return h('header', { class: 'topbar' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': t.pause, onClick: () => openPause(c) }, '⏸'),
    h('span', { class: 'topbar-title' }, mod.title),
    view.round ? h('span', { class: 'topbar-round' }, view.round) : null,
    view.undo && store.canUndo()
      ? h('button', { type: 'button', class: 'text-btn', onClick: () => store.dispatch({ type: 'undo' }) }, '↶ ' + t.undo)
      : null);
}

function openPause(c) {
  const { store, mod, view } = c;
  if (view.props?.timer && timerRunning(view.props.timer)) c.act({ type: 'TIMER_PAUSE' });
  sheet({
    title: t.pause,
    body: `${mod.title}${view.round ? ' · ' + view.round : ''}`,
    actions: [
      { label: t.resume, kind: 'primary' },
      { label: t.rules, onClick: () => rulesSheet(mod) },
      { label: t.home, onClick: () => c.go('#/') },
      { label: t.endGame, kind: 'bad', onClick: () => sheet({
        title: t.endConfirm, body: t.endConfirmBody,
        actions: [
          { label: t.resume, kind: 'secondary' },
          { label: t.end, kind: 'bad', onClick: () => { store.dispatch({ type: 'game/end' }); c.go('#/'); } },
        ],
      }) },
    ],
  });
}

export function rulesSheet(mod) {
  sheet({
    title: mod.title,
    body: h('div', { class: 'rules-sheet' },
      h('ol', { class: 'rules-card' }, mod.rules.map((r) => h('li', {}, r))),
      mod.sides?.length ? h('p', { class: 'label' }, t.sides) : null,
      sidesBlock(mod)),
    actions: [{ label: t.close, kind: 'primary' }],
  });
}

// ---------- shared pieces ----------

const buttons = (list = [], c) => list.map((b) => btn(b.label, () => c.act(b.action), b.kind ?? 'primary'));

function bigName(text, player, extra = '') {
  return h('p', { class: `big${player ? ' is-player' : ''}${extra}`, style: player ? { '--pc': colorOf(player) } : null }, text);
}

function hearts(n, max = 8) {
  return h('span', { class: 'hearts', 'aria-label': `하트 ${n}개` },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'heart' : 'heart is-empty', 'aria-hidden': 'true' }, '♥')));
}

function infobar(p) {
  if (!p.info && p.hearts == null) return null;
  return h('div', { class: 'infobar' }, p.info ? h('span', {}, p.info) : h('span'), p.hearts != null ? hearts(p.hearts) : null);
}

const DECK_MARK = { correct: ['✓', 'good'], wrong: ['✗', 'bad'], pass: ['–', 'muted'], discarded: ['×', 'muted'], allkkwang: ['꽝', 'bad'] };
function deckRow(results) {
  return h('ol', { class: 'deck', 'aria-label': '카드 결과' }, results.map((r, i) => {
    const [mark, tone] = DECK_MARK[r] ?? [String(i + 1), 'empty'];
    return h('li', { class: `deck-dot is-${tone}` }, mark);
  }));
}

function numberScale(n, low, high) {
  return h('div', { class: 'nscale' },
    h('div', { class: 'nscale-cells' }, Array.from({ length: 10 }, (_, i) =>
      h('span', { class: `nscale-cell${i + 1 === n ? ' is-on' : ''}`, style: { '--i': String(i) } }, String(i + 1)))),
    h('div', { class: 'nscale-ends' }, h('span', {}, `1 ${low}`), h('span', {}, `${high} 10`)));
}

function renderSecret(s) {
  if (s.dial) {
    return h('div', { class: 'secret secret-dial' },
      h('p', { class: 'secret-top' }, s.top), dial({ mode: 'peek', ...s.dial }).el);
  }
  if (s.number != null) {
    return h('div', { class: 'secret' },
      h('p', { class: 'secret-top' }, s.top),
      h('p', { class: 'secret-number' }, String(s.number)),
      numberScale(s.number, s.low, s.high));
  }
  return h('div', { class: 'secret' },
    s.top ? h('p', { class: 'secret-top' }, s.top) : null,
    h('p', { class: 'secret-word' }, s.big),
    s.bottom ? h('p', { class: 'secret-bottom' }, s.bottom) : null,
    s.side ? h('p', { class: 'secret-side' }, s.side) : null);
}

function holdBlock(secret, onReveal, label) {
  return h('div', { class: 'hold-screen' },
    h('p', { class: 'hint' }, t.holdHint),
    hold({ render: () => renderSecret(secret), onReveal, label }));
}

function playerGrid(ids, c, onPick, highlight) {
  return h('div', { class: 'vote-grid' }, ids.map((id) => h('button', {
    type: 'button', class: `vote-cell${highlight === id ? ' is-highlight' : ''}`, style: { '--pc': colorOf(c.players[id]) },
    onClick: () => onPick(id),
  }, h('span', { class: 'vote-name' }, c.players[id].name))));
}

function themeHead(p) {
  return h('div', { class: 'theme-head' },
    h('p', { class: 'theme-title' }, p.theme),
    h('p', { class: 'theme-ends' }, h('span', {}, `1 = ${p.low}`), h('span', {}, `10 = ${p.high}`)));
}

// ---------- screens ----------

const SCREENS = {
  hold(p, c) {
    const confirm = btn(p.confirm.label, () => c.act(p.confirm.action), 'primary', { disabled: true });
    return { body: holdBlock(p.secret, () => { confirm.disabled = false; }), dock: [confirm] };
  },

  talk(p, c) {
    const body = [
      infobar(p),
      p.timer ? timer({
        state: p.timer,
        onPause: () => c.act({ type: 'TIMER_PAUSE' }),
        onResume: () => c.act({ type: 'TIMER_RESUME' }),
        onAdd: () => c.act({ type: 'TIMER_ADD', sec: 30 }),
        onExpire: p.timerExpire ? () => c.act(p.timerExpire) : null,
      }) : null,
      p.caption ? caption(p.caption, p.tone) : null,
      p.label ? h('p', { class: 'label' }, p.label) : null,
      p.big ? bigName(p.big, p.bigPlayer ? c.players[p.bigPlayer] : null, p.small ? ' big-small' : '') : null,
      p.sub ? h('p', { class: 'sub' }, p.sub) : null,
      p.deck ? deckRow(p.deck) : null,
      p.peek ? hold({ compact: true, label: p.peek.label, render: () => renderSecret(p.peek.secret) }) : null,
      p.extra ? h('div', { class: 'row' }, p.extra.map((b) => btn(b.label, () => c.act(b.action), 'ghost'))) : null,
    ];
    return { body: h('div', { class: 'talk' }, body), dock: buttons(p.buttons, c) };
  },

  vote(p, c) {
    return {
      body: vote({
        key: c.key, title: p.title, sub: p.sub, highlight: p.highlight,
        players: p.candidates.map((id) => c.players[id]),
        onPick: (id) => c.act(p.action, { playerId: id }),
        tie: p.tie, onTie: (ids) => c.act(p.tie.action, { playerIds: ids }),
      }),
    };
  },

  pickPlayer(p, c) {
    return {
      body: h('div', { class: 'vote' },
        h('h2', { class: 'title' }, p.title),
        p.sub ? h('p', { class: 'muted' }, p.sub) : null,
        playerGrid(p.candidates, c, (id) => c.act(p.action, { playerId: id }))),
      dock: p.cancel ? [btn(p.cancel.label, () => c.act(p.cancel.action), 'secondary')] : [],
    };
  },

  result(p, c) {
    const pts = p.points ?? {};
    const ids = Object.keys(c.players);
    const team = c.res?.team;
    const body = h('div', { class: 'result' },
      caption(p.caption, p.tone),
      p.big ? h('p', { class: 'big' }, p.big) : null,
      p.hearts != null ? hearts(p.hearts) : null,
      p.lines?.length ? h('dl', { class: 'lines' }, p.lines.map((l) => [
        h('dt', {}, l.label),
        h('dd', {}, l.playerId ? h('span', { class: 'chip', style: { '--pc': colorOf(c.players[l.playerId]) } }, l.value) : l.value),
      ])) : null,
      p.deck ? deckRow(p.deck) : null,
      team ? null : h('section', { class: 'points' },
        h('h3', { class: 'label' }, t.pointsTitle),
        h('ol', { class: 'point-list' }, ids.map((id) => h('li', { class: pts[id] ? 'has-points' : '' },
          h('span', { class: 'chip', style: { '--pc': colorOf(c.players[id]) } }, c.players[id].name),
          h('span', { class: 'point-val' }, pts[id] ? `+${pts[id]}` : '0'))))));
    const dock = c.res
      ? [btn(t.again, () => c.store.dispatch({ type: 'game/again' }), 'primary'),
        btn(t.otherGame, () => { c.store.dispatch({ type: 'game/end' }); c.go('#/'); }, 'secondary')]
      : buttons(p.buttons, c);
    return { body, dock };
  },

  // 겹치면 꽝: hold to see the word, then type one clue.
  holdInput(p, c) {
    const st = L(c.key, () => ({ step: 'peek' }));
    if (st.step === 'peek') {
      const next = btn('힌트 쓰기', () => { st.step = 'write'; c.rerender(); }, 'primary', { disabled: true });
      return { body: holdBlock(p.secret, () => { next.disabled = false; }), dock: [next] };
    }
    const ki = koinput({
      placeholders: [p.input.placeholder], maxLength: p.input.maxLength, autofocus: true,
      validate: ([v]) => CHECKS[p.input.check.kind](v, p.input.check),
      onSubmit: (text) => c.act(p.action, { text }),
    });
    return {
      body: h('div', { class: 'write' },
        hold({ compact: true, label: '제시어 다시 보기 (꾹)', render: () => renderSecret(p.secret) }),
        h('p', { class: 'sub' }, '띄어쓰기 없이 한 단어, 정답이 들어가면 안 돼요.'),
        ki.el),
      dock: [ki.submitBtn],
    };
  },

  // 겹치면 꽝: everyone but the 술래 reviews the clues.
  compare(p, c) {
    const st = L(c.key, () => ({ sel: [] }));
    st.sel = st.sel.filter((id) => p.clues.some((x) => x.playerId === id && !x.cancel));
    const REASON = { dup: '겹침', same: '같은 말', invalid: '무효' };
    const cards = p.clues.map((x) => h('button', {
      type: 'button',
      class: `clue-card${x.cancel ? ' is-dead' : ''}${st.sel.includes(x.playerId) ? ' is-picked' : ''}`,
      'aria-pressed': x.cancel ? null : String(st.sel.includes(x.playerId)),
      onClick: () => {
        if (x.cancel) return c.act({ type: 'RESTORE', playerId: x.playerId });
        st.sel = st.sel.includes(x.playerId) ? st.sel.filter((id) => id !== x.playerId) : [...st.sel, x.playerId].slice(-2);
        c.rerender();
      },
    },
    h('span', { class: 'chip', style: { '--pc': colorOf(c.players[x.playerId]) } }, c.players[x.playerId].name),
    h('span', { class: 'clue-text' }, x.text),
    x.cancel ? h('span', { class: 'clue-tag' }, `꽝 · ${REASON[x.cancel]} (눌러서 되살리기)`) : null));
    return {
      body: h('div', { class: 'compare' },
        h('p', { class: 'label' }, '제시어'),
        h('p', { class: 'big big-small' }, p.word),
        h('p', { class: 'sub' }, '겹친 힌트는 이미 꽝! 비슷한 말은 두 개를 골라 같은 말, 반칙 힌트는 하나를 골라 무효.'),
        h('div', { class: 'clue-grid' }, cards)),
      dock: [
        h('div', { class: 'row' },
          btn('같은 말', () => { c.act({ type: 'MERGE', playerIds: st.sel }); st.sel = []; }, 'secondary', { disabled: st.sel.length !== 2 }),
          btn('무효', () => { c.act({ type: 'INVALID', playerId: st.sel[0] }); st.sel = []; }, 'secondary', { disabled: st.sel.length !== 1 })),
        btn(p.show.label, () => c.act(p.show.action), 'primary'),
      ],
    };
  },

  // 겹치면 꽝: the 술래 sees surviving clues.
  cards(p, c) {
    return {
      body: h('div', { class: 'talk' },
        h('p', { class: 'label' }, p.label),
        h('div', { class: 'clue-grid is-big' }, p.cards.map((x) => h('div', { class: `clue-card${x.dead ? ' is-dead is-grey' : ''}` },
          h('span', { class: 'clue-text' }, x.text)))),
        h('p', { class: 'sub' }, p.sub)),
      dock: [h('div', { class: 'row row-3' }, buttons(p.buttons, c))],
    };
  },

  // 사라지는 힌트: the 출제자 picks one of three words.
  pick(p, c) {
    return {
      body: h('div', { class: 'talk' },
        infobar(p),
        h('h2', { class: 'title' }, p.title),
        h('div', { class: 'pick-list' }, p.options.map((o) => btn(o.label, () => c.act(o.action), 'option')))),
    };
  },

  // 사라지는 힌트: the 출제자 writes four clues.
  write(p, c) {
    const ki = koinput({
      fields: p.fields, maxLength: p.maxLength, autofocus: true,
      placeholders: Array.from({ length: p.fields }, (_, i) => `힌트 ${i + 1}`),
      validate: (vals) => CHECKS[p.check.kind](vals, p.check),
      onSubmit: (clues) => c.act(p.action, { clues }),
      submitLabel: '힌트 확정',
    });
    return {
      body: h('div', { class: 'write' },
        h('p', { class: 'label' }, p.info),
        h('p', { class: 'secret-word is-inline' }, p.word),
        h('p', { class: 'sub' }, p.sub),
        ki.el),
      dock: [ki.submitBtn],
    };
  },

  // 사라지는 힌트: guess secretly, then erase one clue for the next person.
  eraser(p, c) {
    const cards = (onTap) => h('div', { class: 'clue-grid is-big' }, p.clues.map((x) => h(onTap ? 'button' : 'div', {
      type: onTap ? 'button' : null, class: `clue-card${onTap ? ' is-erasable' : ''}`,
      onClick: onTap ? (e) => onTap(x, e.currentTarget) : null,
    }, h('span', { class: 'clue-text' }, x.text))));
    if (p.stage === 'guess') {
      const ki = koinput({
        placeholders: ['정답'], maxLength: p.maxLength, autofocus: false,
        onSubmit: (text) => c.act(p.guessAction, { text }),
        submitLabel: '정답 잠그기',
      });
      return {
        body: h('div', { class: 'write' },
          h('p', { class: 'label' }, `남은 힌트 ${p.left}개`),
          cards(null),
          h('p', { class: 'sub' }, p.note),
          ki.el),
        dock: [ki.submitBtn],
      };
    }
    let busy = false;
    return {
      body: h('div', { class: 'write' },
        h('p', { class: 'locked' }, '내 정답 ●●● 잠금 완료'),
        h('h2', { class: 'title' }, '지울 힌트를 하나 눌러요'),
        h('p', { class: 'sub' }, '다음 사람에게 남길 힌트를 생각하며 골라요.'),
        cards((x, el) => {
          if (busy) return;
          busy = true;
          el.classList.add('is-crumbling');
          setTimeout(() => c.act(p.eraseAction, { index: x.index }), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380);
        })),
    };
  },

  // 사라지는 힌트: answer, then each guess one at a time; tap to toggle 정답 인정.
  judge(p, c) {
    const st = L(c.key, () => ({ shown: 0 }));
    const all = st.shown >= p.guesses.length;
    const rows = p.guesses.slice(0, st.shown).map((g) => h('li', {},
      h('button', { type: 'button', class: `guess-row${g.ok ? ' is-ok' : ' is-no'}`, onClick: () => c.act(g.action) },
        h('span', { class: 'chip', style: { '--pc': colorOf(c.players[g.playerId]) } }, c.players[g.playerId].name),
        h('span', { class: 'guess-text' }, g.text || '—'),
        h('span', { class: 'guess-mark' }, g.ok ? '정답' : '틀림'))));
    return {
      body: h('div', { class: 'talk' },
        infobar(p),
        h('p', { class: 'label' }, '정답'),
        caption(p.caption),
        h('ol', { class: 'guess-list' }, rows),
        all ? h('p', { class: 'sub' }, p.sub) : null),
      dock: all ? buttons(p.buttons, c)
        : [btn(st.shown === 0 ? '첫 번째 답 보기' : '다음 답 보기', () => { st.shown++; c.rerender(); }, 'primary')],
    };
  },

  // 1부터 10까지: answers out loud; the 선장 jots memos.
  memo(p, c) {
    const openMemo = (card) => {
      const ki = koinput({
        placeholders: ['2~3 단어 메모'], maxLength: p.maxLength, allowEmpty: true, autofocus: true, submitLabel: '메모 저장',
        onSubmit: (text) => { closeSheet(); c.act(p.memoAction, { playerId: card.playerId, text }); },
      });
      ki.inputs[0].value = card.memo;
      sheet({ title: `${c.players[card.playerId].name} 메모`, body: h('div', {}, ki.el, ki.submitBtn), actions: [{ label: t.cancel }] });
    };
    return {
      body: h('div', { class: 'talk' },
        infobar(p),
        themeHead(p),
        h('p', { class: 'sub' }, p.sub),
        h('ol', { class: 'memo-list' }, p.cards.map((card, i) => h('li', {},
          h('button', { type: 'button', class: 'memo-card', style: { '--pc': colorOf(c.players[card.playerId]) }, onClick: () => openMemo(card) },
            h('span', { class: 'sort-rank' }, String(i + 1)),
            h('span', { class: 'sort-name' }, c.players[card.playerId].name),
            h('span', { class: `sort-memo${card.memo ? '' : ' is-empty'}` }, card.memo || '눌러서 메모')))))),
      dock: buttons(p.buttons, c),
    };
  },

  // 1부터 10까지: the 선장 sorts, smallest on top.
  sorter(p, c) {
    const s = sorter({
      items: p.cards.map((x) => ({ id: x.playerId, player: c.players[x.playerId], memo: x.memo })),
      topLabel: `작은 수 · ${p.low}`, bottomLabel: `큰 수 · ${p.high}`,
    });
    return {
      body: h('div', { class: 'talk' }, infobar(p), themeHead(p),
        h('p', { class: 'sub' }, '꾹 눌러 끌거나 화살표로 순서를 바꿔요.'), s.el),
      dock: [
        p.back ? btn(p.back.label, () => c.act(p.back.action), 'secondary') : null,
        btn('확정', () => c.act(p.action, { order: s.getOrder() }), 'primary'),
      ],
    };
  },

  // 1부터 10까지: numbers flip one by one from the top.
  sorted(p, c) {
    const list = sortedList({ items: p.cards.map((x) => ({ ...x, player: c.players[x.playerId] })) });
    list.els.forEach((el, i) => el.style.setProperty('--i', String(i)));
    const cap = h('div', { class: 'delay-in' }, caption(p.caption, p.tone));
    cap.style.setProperty('--d', `${p.cards.length * 600 + 200}ms`);
    return {
      body: h('div', { class: 'talk' },
        h('div', { class: 'infobar' }, h('span', {}, p.lost ? `하트 -${p.lost}` : '하트 그대로!'), hearts(p.hearts)),
        themeHead(p), cap, list.el),
      dock: buttons(p.buttons, c),
    };
  },

  // 마음 다이얼: the 출제자 says (or types) a clue.
  clue(p, c) {
    const ki = koinput({
      placeholders: [p.placeholder], maxLength: 20, allowEmpty: true, submitLabel: p.submitLabel,
      onSubmit: (text) => c.act(p.action, { text }),
    });
    return {
      body: h('div', { class: 'talk' },
        infobar(p),
        h('p', { class: 'spectrum' }, h('span', {}, p.left), h('span', { 'aria-hidden': 'true' }, '↔'), h('span', {}, p.right)),
        p.label ? h('p', { class: 'label' }, p.label) : null,
        bigName(p.big, c.players[p.bigPlayer]),
        h('p', { class: 'sub' }, p.sub),
        ki.el),
      dock: [ki.submitBtn],
    };
  },

  // 마음 다이얼: tune (team drags) and reveal (band sweeps in).
  dial(p, c) {
    if (p.mode === 'tune') {
      const d = dial({ mode: 'tune', left: p.left, right: p.right, needle: 50 });
      return {
        body: h('div', { class: 'talk' },
          infobar(p),
          p.clue ? h('p', { class: 'clue-banner' }, h('span', { class: 'label' }, '힌트'), ' ', p.clue) : null,
          d.el,
          h('p', { class: 'sub' }, p.sub)),
        dock: [btn('고정!', () => c.act(p.action, { value: d.getValue() }), 'primary')],
      };
    }
    const d = dial({ mode: 'reveal', left: p.left, right: p.right, needle: p.needle, target: p.target });
    return {
      body: h('div', { class: 'talk' },
        caption(p.caption, p.tone),
        p.clue ? h('p', { class: 'clue-banner' }, h('span', { class: 'label' }, '힌트'), ' ', p.clue) : null,
        d.el,
        h('p', { class: 'sub' }, p.sub)),
      dock: buttons(p.buttons, c),
    };
  },
};

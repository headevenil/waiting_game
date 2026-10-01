// Game start screen: the 3-line rules card, options, and 시작하기.
import { h, btn } from '../ui/h.js';
import { t } from '../i18n/ko.js';
import { byId } from '../games/registry.js';
import { categories } from '../content.js';
import { sheet } from '../ui/sheet.js';

const asChoice = (c) => (c && typeof c === 'object' ? c : { value: c, label: String(c) });

export function rulesScreen(ctx, gameId) {
  const { store } = ctx;
  const mod = byId[gameId];
  if (!mod) { ctx.go('#/'); return h('div'); }
  const st = store.state;
  const saved = st.settings.gameOptions?.[gameId] ?? {};
  const n = st.roster.length;
  const chosen = {};

  function choicesFor(spec) {
    if (spec.choices === 'content:categories') {
      // Only topics with enough words to draw from (라이어 찾기 needs at least 3).
      const { words } = ctx.content;
      const usable = categories(words).filter((c) => words.filter((w) => w.cat === c).length >= 3);
      return [t.random, ...usable].map(asChoice);
    }
    const perPlayer = n >= mod.players.min ? n : mod.players.best;
    return spec.choices.map(asChoice).map((c) => (c.perPlayer ? { ...c, label: `${c.label} (${perPlayer}판)` } : c));
  }

  const entries = Object.entries(mod.options);
  for (const [k, spec] of entries) {
    chosen[k] = choicesFor(spec).some((c) => c.value === saved[k]) ? saved[k] : spec.default;
  }

  const section = h('section', { class: 'options' });
  function drawOptions() {
    section.replaceChildren(...entries.map(([k, spec]) => {
      const choices = choicesFor(spec);
      if (!choices.some((c) => c.value === chosen[k])) chosen[k] = spec.default;
      return h('div', { class: 'option' },
        h('p', { class: 'option-label' }, spec.label),
        h('div', { class: 'seg seg-wrap', role: 'radiogroup', 'aria-label': spec.label }, choices.map((c) => h('button', {
          type: 'button', role: 'radio', class: 'seg-btn', 'aria-checked': String(chosen[k] === c.value),
          onClick: () => { chosen[k] = c.value; drawOptions(); },
        }, c.label))),
        spec.note ? h('p', { class: 'option-note' }, spec.note) : null);
    }));
  }
  drawOptions();

  const problem = n < mod.players.min ? t.tooFew(mod.players.min) : n > mod.players.max ? t.tooMany(mod.players.max) : null;

  function start() {
    const go = () => {
      store.dispatch({ type: 'game/start', gameId, options: { ...chosen } });
      ctx.go('#/play');
    };
    if (st.game) {
      sheet({
        title: t.replaceGame, body: t.replaceGameBody,
        actions: [{ label: t.cancel }, { label: t.startNew, kind: 'primary', onClick: go }],
      });
    } else go();
  }

  return h('div', { class: 'screen' },
    h('header', { class: 'topbar' },
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': t.home }, '←'),
      h('h1', { class: 'topbar-title' }, mod.title)),
    h('main', { class: 'main', id: 'main' },
      h('p', { class: 'muted' }, `${t.minutes(mod.minutes)} · ${t.playersRange(mod.players)} · ${mod.players.best}명일 때 제일 좋아요`),
      h('section', { class: 'card' },
        h('h2', { class: 'section-title' }, t.howToPlay),
        h('ol', { class: 'rules-card' }, mod.rules.map((r) => h('li', {}, r)))),
      entries.length ? section : null,
      problem ? h('p', { class: 'warn' }, problem, ' ', h('a', { href: '#/roster' }, t.editRoster)) : null),
    h('footer', { class: 'dock' }, btn(t.start, start, 'primary', { disabled: !!problem })));
}

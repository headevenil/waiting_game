// Roster: 4–6 names with colours. Edits stay in the DOM until 저장하기, so typing Korean is never interrupted.
import { h, btn, PLAYER_COLORS, colorOf } from '../ui/h.js';
import { t } from '../i18n/ko.js';
import { COLORS } from '../store.js';
import { len } from '../i18n/norm.js';

const MAX_NAME = 8;

export function rosterScreen(ctx) {
  const { store } = ctx;
  let rows = store.state.roster.map((p) => ({ ...p }));
  while (rows.length < 4) rows.push(blank());
  const list = h('ol', { class: 'roster' });
  const err = h('p', { class: 'koinput-error', role: 'alert' });
  const addBtn = btn(t.addPlayer, () => { sync(); rows.push(blank()); draw(); list.querySelector('li:last-child input')?.focus(); }, 'secondary');

  function blank() {
    const used = new Set(rows?.map((r) => r.color) ?? []);
    const ids = new Set([...(rows ?? []), ...store.state.roster].map((r) => r.id));
    let n = 1;
    while (ids.has(`p${n}`)) n++;
    return { id: `p${n}`, name: '', color: COLORS.find((c) => !used.has(c)) ?? COLORS[0] };
  }

  // Read current input values back into rows before any redraw.
  function sync() {
    [...list.querySelectorAll('input')].forEach((el, i) => { rows[i].name = el.value.normalize('NFC'); });
  }

  function draw() {
    list.replaceChildren(...rows.map((r, i) => h('li', { class: 'roster-row' },
      h('button', {
        type: 'button', class: 'color-dot', style: { '--pc': colorOf(r) },
        'aria-label': `색 바꾸기 (지금 ${PLAYER_COLORS[r.color]?.label})`,
        onClick: () => { sync(); r.color = COLORS[(COLORS.indexOf(r.color) + 1) % COLORS.length]; draw(); },
      }),
      h('input', {
        type: 'text', class: 'koinput-field', value: r.name, placeholder: t.namePlaceholder(i + 1),
        lang: 'ko', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'next',
        'aria-label': t.namePlaceholder(i + 1),
        onKeydown: (e) => {
          if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          list.querySelectorAll('input')[i + 1]?.focus();
        },
      }),
      rows.length > 4
        ? h('button', { type: 'button', class: 'text-btn', onClick: () => { sync(); rows.splice(i, 1); draw(); } }, t.remove)
        : null)));
    addBtn.disabled = rows.length >= 6;
  }

  function save() {
    for (const el of list.querySelectorAll('input')) el.blur();
    setTimeout(() => {
      sync();
      const names = rows.map((r) => r.name.trim());
      if (names.some((n) => !n)) return void (err.textContent = t.nameEmpty);
      if (names.some((n) => len(n) > MAX_NAME)) return void (err.textContent = `이름은 ${MAX_NAME}글자까지만 돼요`);
      if (new Set(names).size !== names.length) return void (err.textContent = t.nameDup);
      if (rows.length < 4 || rows.length > 6) return void (err.textContent = t.rosterCount);
      store.dispatch({ type: 'roster/set', players: rows });
      ctx.go('#/');
    }, 0);
  }

  draw();
  return h('div', { class: 'screen' },
    h('header', { class: 'topbar' },
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': t.home }, '←'),
      h('h1', { class: 'topbar-title' }, t.rosterEdit)),
    h('main', { class: 'main', id: 'main' },
      h('p', { class: 'muted' }, t.rosterHelp),
      list, err, addBtn,
      store.state.game ? h('p', { class: 'muted small' }, '진행 중인 게임에는 바뀐 멤버가 적용되지 않아요.') : null),
    h('footer', { class: 'dock' }, btn(t.save, save, 'primary')));
}

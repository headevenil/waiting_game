// Settings: theme, haptics, resets, version and offline status.
import { h, btn } from '../ui/h.js';
import { t } from '../i18n/ko.js';
import { sheet, toast } from '../ui/sheet.js';

function seg(label, value, choices, onPick) {
  return h('div', { class: 'option' },
    h('p', { class: 'option-label' }, label),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, choices.map(([v, l]) => h('button', {
      type: 'button', role: 'radio', class: 'seg-btn', 'aria-checked': String(value === v), onClick: () => onPick(v),
    }, l))));
}

export function settingsScreen(ctx) {
  const { store, sw } = ctx;
  const s = store.state.settings;
  const set = (patch) => store.dispatch({ type: 'settings/set', patch });
  const confirm = (title, body, label, action, done) => sheet({
    title, body,
    actions: [{ label: t.cancel }, { label, kind: 'bad', onClick: () => { store.dispatch(action); toast(done); } }],
  });

  return h('div', { class: 'screen' },
    h('header', { class: 'topbar' },
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': t.home }, '←'),
      h('h1', { class: 'topbar-title' }, t.settings)),
    h('main', { class: 'main', id: 'main' },
      h('section', { class: 'options' },
        seg(t.theme, s.theme, [['auto', t.themeAuto], ['day', t.day], ['night', t.night]], (v) => set({ theme: v })),
        seg(t.haptics, s.haptics, [[true, t.on], [false, t.off]], (v) => set({ haptics: v }))),
      h('section', { class: 'stack' },
        btn(t.resetScores, () => confirm(t.resetScores, t.resetScoresConfirm, t.resetScores, { type: 'session/reset' }, '점수를 초기화했어요'), 'secondary'),
        btn(t.clearRecent, () => { store.dispatch({ type: 'recent/clear' }); toast('최근 단어 기록을 지웠어요'); }, 'secondary'),
        btn(t.resetAll, () => confirm(t.resetAll, t.resetAllConfirm, t.resetAll, { type: 'all/reset' }, '모든 데이터를 지웠어요'), 'bad')),
      h('section', { class: 'card' },
        h('dl', { class: 'lines' },
          h('dt', {}, t.version), h('dd', {}, sw.version ?? '—'),
          h('dt', {}, '오프라인'), h('dd', {}, sw.offlineReady ? t.offlineReady : t.offlineNotYet)),
        sw.updateReady ? btn(t.update, sw.applyUpdate, 'primary') : null)));
}

// Pass gate: full screen in the next player's colour. The button must be tapped, so a bump never advances.
import { h, btn, colorOf } from './h.js';
import { t } from '../i18n/ko.js';
import { buzz, HAPTIC } from './haptics.js';

export function gate({ player, note, onConfirm }) {
  buzz(HAPTIC.turn);
  return h('section', { class: 'gate', style: { '--pc': colorOf(player) }, 'aria-label': t.passTo(player.name) },
    h('div', { class: 'gate-body' },
      h('p', { class: 'gate-name' }, player.name),
      h('p', { class: 'gate-text' }, t.passToSuffix),
      note ? h('p', { class: 'gate-note' }, note) : null),
    h('div', { class: 'gate-dock' }, btn(t.iAm(player.name), onConfirm, 'gate')));
}

// Group gate, e.g. "술래 빼고 보세요" or "다 같이 보세요".
export function groupGate({ title, sub, button, onConfirm }) {
  buzz(HAPTIC.turn);
  return h('section', { class: 'gate gate-group' },
    h('div', { class: 'gate-body' },
      h('p', { class: 'gate-name' }, title),
      sub ? h('p', { class: 'gate-text' }, sub) : null),
    h('div', { class: 'gate-dock' }, btn(button ?? '확인', onConfirm, 'gate')));
}

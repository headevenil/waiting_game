// Bottom sheet for confirms ("게임을 끝낼까요?") and a small toast. Both live outside #app,
// so a re-render underneath never closes them.
import { h, btn } from './h.js';

let open = null;

export function sheet({ title, body, actions = [], onClose }) {
  open?.close();
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    title ? h('h2', { class: 'title' }, title) : null,
    body ? (body instanceof Node ? body : h('p', { class: 'muted' }, body)) : null,
    h('div', { class: 'sheet-actions' }, actions.map((a) => btn(a.label, () => { close(); a.onClick?.(); }, a.kind ?? 'secondary'))));
  const backdrop = h('div', { class: 'sheet-backdrop', onClick: (e) => { if (e.target === backdrop) { close(); onClose?.(); } } }, panel);
  const onKey = (e) => { if (e.key === 'Escape') { close(); onClose?.(); } };
  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (open?.close === close) open = null;
  }
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  panel.querySelector('button')?.focus();
  open = { close };
  return close;
}

export const closeSheet = () => open?.close();

export function toast(msg, ms = 2600) {
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

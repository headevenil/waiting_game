// Hold-to-reveal: the secret exists in the DOM only while a finger is down.
import { h, onCleanup } from './h.js';
import { t } from '../i18n/ko.js';

const AUTO_HIDE_MS = 3000;

export function hold({ render, onReveal, label = t.holdHere, compact = false }) {
  let shown = false, timer = null;
  const face = () => h('div', { class: 'hold-face' },
    h('span', { class: 'hold-icon', 'aria-hidden': 'true' }, '👆'),
    h('span', {}, label));
  const box = h('div', {
    class: `hold${compact ? ' hold-compact' : ''}`, role: 'button', tabindex: '0',
    'aria-label': t.holdAria,
  }, face());

  function show(e) {
    if (shown) return;
    if (e?.button > 0) return;
    shown = true;
    box.classList.add('on');
    box.replaceChildren(render());
    onReveal?.();
    clearTimeout(timer);
    timer = setTimeout(hide, AUTO_HIDE_MS);
  }
  function hide() {
    if (!shown) return;
    shown = false;
    clearTimeout(timer);
    box.classList.remove('on');
    box.replaceChildren(face());
  }

  box.addEventListener('pointerdown', (e) => { e.preventDefault(); show(e); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) box.addEventListener(ev, hide);
  box.addEventListener('contextmenu', (e) => e.preventDefault());
  box.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show(); } });
  box.addEventListener('keyup', hide);
  box.addEventListener('blur', hide);
  const onVis = () => { if (document.visibilityState !== 'visible') hide(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', hide);
  onCleanup(() => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('blur', hide);
  });
  return box;
}

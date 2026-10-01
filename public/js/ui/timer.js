// Ring countdown. Reads the deadline from game state and updates its own DOM; dispatches only on
// pause / resume / +30초 / expiry.
import { h, onCleanup } from './h.js';
import { t } from '../i18n/ko.js';
import { buzz, HAPTIC } from './haptics.js';

const R = 44, CIRC = 2 * Math.PI * R;
const fmt = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function timer({ state, onPause, onResume, onAdd, onExpire }) {
  const paused = state.remaining != null;
  const left = () => (paused ? state.remaining : Math.max(0, state.deadline - Date.now()));
  const ring = h('svg:circle', { class: 'timer-ring', cx: 50, cy: 50, r: R, 'stroke-dasharray': CIRC.toFixed(1) });
  const text = h('span', { class: 'timer-text' });
  const wrap = h('div', { class: `timer${paused ? ' is-paused' : ''}`, role: 'timer', 'aria-live': 'off' },
    h('div', { class: 'timer-dial' },
      h('svg:svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        h('svg:circle', { class: 'timer-track', cx: 50, cy: 50, r: R }), ring),
      text),
    h('div', { class: 'timer-actions' },
      paused
        ? h('button', { type: 'button', class: 'btn btn-primary btn-small', onClick: onResume }, `${t.paused} · ${t.resume}`)
        : h('button', { type: 'button', class: 'btn btn-secondary btn-small', onClick: onPause }, '⏸ ' + t.pause),
      h('button', { type: 'button', class: 'btn btn-secondary btn-small', onClick: onAdd }, t.plus30)));

  let warned = false, fired = false;
  function paint() {
    const ms = left();
    text.textContent = ms > 0 ? fmt(ms) : t.timeUp;
    const frac = state.total ? ms / (state.total * 1000) : 0;
    ring.setAttribute('stroke-dashoffset', (CIRC * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1));
    const last10 = ms > 0 && ms <= 10_000;
    wrap.classList.toggle('is-urgent', last10 && !paused);
    if (last10 && !warned && !paused) { warned = true; buzz(HAPTIC.turn); }
    if (ms <= 0 && !fired && !paused) {
      fired = true;
      wrap.classList.add('is-done');
      buzz(HAPTIC.timeUp);
      onExpire?.();
    }
  }
  paint();
  if (!paused) {
    const id = setInterval(paint, 250);
    onCleanup(() => clearInterval(id));
  }
  return wrap;
}

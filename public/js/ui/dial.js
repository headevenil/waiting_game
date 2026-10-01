// 마음 다이얼: SVG half circle mapped to 0–100. The target band is only drawn in peek and reveal;
// during tune it is not in the DOM at all.
import { h } from './h.js';
import { buzz, HAPTIC } from './haptics.js';
import { ZONES } from '../games/dial.js';

const CX = 110, CY = 110, R = 100;
const angle = (v) => Math.PI * (1 - v / 100);
const pt = (v, r = R) => [CX + r * Math.cos(angle(v)), CY - r * Math.sin(angle(v))];
const clamp = (v) => Math.max(0, Math.min(100, v));

function wedge(a, b, cls) {
  const [x1, y1] = pt(clamp(a));
  const [x2, y2] = pt(clamp(b));
  return h('svg:path', { class: cls, d: `M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z` });
}

function band(target) {
  const zones = ZONES.filter((z) => z.points > 0).reverse();     // widest first, so narrower ones paint on top
  return h('svg:g', { class: 'dial-band' },
    zones.map((z) => wedge(target - z.max - 0.5, target + z.max + 0.5, `band band-${z.points}`)));
}

function needleEl(v) {
  const [x, y] = pt(v, R * 0.94);
  return h('svg:g', { class: 'dial-needle' },
    h('svg:line', { x1: CX, y1: CY, x2: x.toFixed(2), y2: y.toFixed(2) }),
    h('svg:circle', { cx: CX, cy: CY, r: 9 }));
}

export function dial({ mode, left, right, target, needle = 50, onChange }) {
  let value = needle;
  const face = h('svg:path', { class: 'dial-face', d: `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY} Z` });
  const ticks = h('svg:g', { class: 'dial-ticks' }, [0, 25, 50, 75, 100].map((v) => {
    const [x1, y1] = pt(v, R); const [x2, y2] = pt(v, R - 8);
    return h('svg:line', { x1, y1, x2, y2 });
  }));
  let needleNode = mode === 'peek' ? null : needleEl(value);
  const svg = h('svg:svg', {
    class: `dial dial-${mode}`, viewBox: '0 0 220 122', role: mode === 'tune' ? 'slider' : 'img',
    'aria-label': `${left}에서 ${right} 사이`, 'aria-valuemin': mode === 'tune' ? 0 : null, 'aria-valuemax': mode === 'tune' ? 100 : null,
    'aria-valuenow': mode === 'tune' ? value : null, tabindex: mode === 'tune' ? '0' : null,
  }, face, (mode === 'peek' || mode === 'reveal') && target != null ? band(target) : null, ticks, needleNode);

  const ends = h('div', { class: 'dial-ends' }, h('span', { class: 'dial-left' }, '◀ ' + left), h('span', { class: 'dial-right' }, right + ' ▶'));
  const wrap = h('div', { class: 'dial-wrap' }, svg, ends);

  if (mode === 'tune') {
    let lastTick = Math.round(value / 5);
    const set = (v) => {
      value = Math.round(clamp(v));
      const n = needleEl(value);
      needleNode.replaceWith(n);
      needleNode = n;
      svg.setAttribute('aria-valuenow', String(value));
      const tick = Math.round(value / 5);
      if (tick !== lastTick) { lastTick = tick; buzz(HAPTIC.tick); }
      onChange?.(value);
    };
    const fromPointer = (e) => {
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 220 - CX;
      const y = CY - ((e.clientY - rect.top) / rect.height) * 122;
      let a = Math.atan2(y, x);                       // −π..π, 0 = right
      if (a < 0) a = x < 0 ? Math.PI : 0;             // below the centre: snap to the nearest end
      set((1 - a / Math.PI) * 100);
    };
    let dragging = false;
    svg.addEventListener('pointerdown', (e) => { dragging = true; svg.setPointerCapture(e.pointerId); fromPointer(e); });
    svg.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
    svg.addEventListener('pointerup', () => { dragging = false; });
    svg.addEventListener('pointercancel', () => { dragging = false; });
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(value - 1); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(value + 1); }
    });
  }
  return { el: wrap, getValue: () => value };
}

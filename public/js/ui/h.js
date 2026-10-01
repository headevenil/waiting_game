// Tiny DOM builder. Styles go through CSSOM (el.style), never a style attribute string, so the strict CSP holds.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...kids) {
  const svg = tag.startsWith('svg:');
  const el = svg ? document.createElementNS(SVG_NS, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), val);
    else if (k === 'ref') v(el);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (!svg && (k === 'value' || k === 'disabled' || k === 'checked')) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// Components register teardown (timers, listeners) for the next render.
let cleanups = [];
export const onCleanup = (fn) => { cleanups.push(fn); };
export function runCleanups() {
  const fns = cleanups;
  cleanups = [];
  for (const fn of fns) { try { fn(); } catch { /* ignore */ } }
}

export const PLAYER_COLORS = {
  yellow: { css: 'var(--p1)', label: '노랑' },
  orange: { css: 'var(--p2)', label: '주황' },
  sky: { css: 'var(--p3)', label: '하늘' },
  green: { css: 'var(--p4)', label: '초록' },
  pink: { css: 'var(--p5)', label: '분홍' },
  purple: { css: 'var(--p6)', label: '보라' },
};
export const colorOf = (player) => PLAYER_COLORS[player?.color]?.css ?? 'var(--caption)';

// A button that is always a real <button>, at least --tap tall.
export function btn(label, onClick, kind = 'primary', extra = {}) {
  const { class: cls, ...rest } = extra;
  return h('button', { type: 'button', class: `btn btn-${kind}${cls ? ' ' + cls : ''}`, onClick, ...rest }, label);
}

export function chip(player) {
  return h('span', { class: 'chip', style: { '--pc': colorOf(player) } }, player?.name ?? '');
}

// Long-press drag list (200 ms) with up/down arrow buttons as a one-handed / accessible fallback.
// Updates its own DOM during a drag; the caller reads the order on 확정.
import { h, colorOf } from './h.js';
import { buzz, HAPTIC } from './haptics.js';

const PRESS_MS = 200;

export function sorter({ items, topLabel, bottomLabel }) {
  let order = items.slice();
  const list = h('ol', { class: 'sorter', 'aria-label': '작은 수부터 큰 수 순서' });
  const wrap = h('div', { class: 'sorter-wrap' },
    h('p', { class: 'sorter-end' }, '▲ ' + topLabel), list, h('p', { class: 'sorter-end' }, '▼ ' + bottomLabel));

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    buzz(HAPTIC.tick);
    render(order[j].id);
  }

  function card(item, i) {
    const el = h('li', { class: 'sort-card', style: { '--pc': colorOf(item.player) }, 'data-id': item.id },
      h('span', { class: 'sort-rank' }, String(i + 1)),
      h('div', { class: 'sort-main' },
        h('span', { class: 'sort-name' }, item.player.name),
        item.memo ? h('span', { class: 'sort-memo' }, item.memo) : null),
      h('div', { class: 'sort-arrows' },
        h('button', { type: 'button', class: 'arrow', 'aria-label': `${item.player.name} 위로`, disabled: i === 0, onClick: () => move(i, -1) }, '▲'),
        h('button', { type: 'button', class: 'arrow', 'aria-label': `${item.player.name} 아래로`, disabled: i === order.length - 1, onClick: () => move(i, 1) }, '▼')));
    attachDrag(el, i);
    return el;
  }

  function render(focusId) {
    list.replaceChildren(...order.map(card));
    if (focusId) list.querySelector(`[data-id="${focusId}"]`)?.classList.add('is-moved');
  }

  function attachDrag(el, index) {
    let timer = null, dragging = false, startY = 0, slot = 0, pid = null;
    const cards = () => [...list.children];
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.arrow')) return;
      pid = e.pointerId;
      startY = e.clientY;
      timer = setTimeout(() => {
        dragging = true;
        slot = el.getBoundingClientRect().height + 8;
        el.setPointerCapture?.(pid);
        el.classList.add('is-dragging');
        buzz(HAPTIC.tick);
      }, PRESS_MS);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) {
        if (Math.abs(e.clientY - startY) > 8) clearTimeout(timer);
        return;
      }
      e.preventDefault();
      const dy = e.clientY - startY;
      el.style.transform = `translateY(${dy}px)`;
      const target = Math.max(0, Math.min(order.length - 1, index + Math.round(dy / slot)));
      cards().forEach((c, i) => {
        if (c === el) return;
        let shift = 0;
        if (index < target && i > index && i <= target) shift = -slot;
        if (index > target && i < index && i >= target) shift = slot;
        c.style.transform = shift ? `translateY(${shift}px)` : '';
      });
      el.dataset.target = String(target);
    });
    const end = () => {
      clearTimeout(timer);
      if (!dragging) return;
      dragging = false;
      const target = Number(el.dataset.target ?? index);
      const [it] = order.splice(index, 1);
      order.splice(target, 0, it);
      render(it.id);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  render();
  return { el: wrap, getOrder: () => order.map((x) => x.id) };
}

// Same list, locked, with numbers flipping one by one from the top.
export function sortedList({ items, onDone }) {
  const list = h('ol', { class: 'sorter is-locked' });
  const els = items.map((item, i) => h('li', { class: 'sort-card', style: { '--pc': colorOf(item.player) } },
    h('span', { class: 'sort-rank' }, String(i + 1)),
    h('div', { class: 'sort-main' },
      h('span', { class: 'sort-name' }, item.player.name),
      item.memo ? h('span', { class: 'sort-memo' }, item.memo) : null),
    h('span', { class: `sort-number${item.bad ? ' is-bad' : ''}`, 'aria-label': `${item.number}${item.bad ? ', 순서 틀림' : ''}` },
      h('span', { class: 'flip-back' }, '?'),
      h('span', { class: 'flip-front' }, String(item.number)))));
  list.replaceChildren(...els);
  return { el: list, els, onDone };
}

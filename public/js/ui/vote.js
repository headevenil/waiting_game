// Point vote: "하나, 둘, 셋!" countdown, then a grid of names. Tie handling lives in the game reducer.
import { h, btn, colorOf, onCleanup } from './h.js';

const counted = new Set();   // countdown runs once per vote key, not on every re-render

export function vote({ key, title, sub, players, highlight, onPick, tie, onTie }) {
  const wrap = h('div', { class: 'vote' });
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  let selecting = false;
  const picked = new Set();

  function grid() {
    const cells = players.map((p) => h('button', {
      type: 'button',
      class: `vote-cell${picked.has(p.id) ? ' is-picked' : ''}${highlight === p.id ? ' is-highlight' : ''}`,
      style: { '--pc': colorOf(byId[p.id]) },
      'aria-pressed': selecting ? String(picked.has(p.id)) : null,
      onClick: () => {
        if (!selecting) return onPick(p.id);
        picked.has(p.id) ? picked.delete(p.id) : picked.add(p.id);
        render();
      },
    }, h('span', { class: 'vote-name' }, p.name), highlight === p.id ? h('span', { class: 'vote-tag' }, '맞힌 사람') : null));
    const tieRow = !tie ? null : selecting
      ? h('div', { class: 'row' },
        btn('취소', () => { selecting = false; picked.clear(); render(); }, 'secondary'),
        btn(`동점 ${picked.size}명 다시 투표`, () => onTie([...picked]), 'primary', { disabled: picked.size < 2 }))
      : btn(tie.label, () => {
        if (tie.select) { selecting = true; render(); } else onTie([]);
      }, 'secondary');
    return [
      h('h2', { class: 'title' }, selecting ? '동점인 사람을 모두 골라요' : title),
      sub && !selecting ? h('p', { class: 'muted' }, sub) : null,
      h('div', { class: 'vote-grid' }, cells),
      tieRow,
    ];
  }
  function render() { wrap.replaceChildren(...grid().filter(Boolean)); }

  if (counted.has(key)) {
    render();
  } else {
    const words = ['하나', '둘', '셋!'];
    let i = 0;
    const big = h('p', { class: 'vote-count', 'aria-live': 'assertive' }, words[0]);
    const skip = btn('바로 투표하기', () => finish(), 'secondary', { class: 'btn-small' });
    wrap.replaceChildren(h('p', { class: 'muted center' }, '다 같이 가리킬 준비!'), big, skip);
    const id = setInterval(() => { i++; if (i < words.length) big.textContent = words[i]; else finish(); }, 900);
    function finish() { clearInterval(id); counted.add(key); render(); }
    onCleanup(() => clearInterval(id));
  }
  return wrap;
}

export const resetVoteCountdowns = () => counted.clear();

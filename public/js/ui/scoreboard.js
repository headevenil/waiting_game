// Session scoreboard: colour chip + name + total; today's leader marked 오늘의 1등.
import { h, colorOf } from './h.js';
import { t } from '../i18n/ko.js';
import { byId } from '../games/registry.js';

const BEST_FORMAT = {
  dial: (n) => `${n}점`,
  scale10: (n) => `하트 ${n}개`,
  kkwang: (n) => `${n}/10`,
};

export function scoreboard({ roster, scores, bests = {} }) {
  const top = Math.max(0, ...roster.map((p) => scores[p.id] ?? 0));
  const rows = roster.map((p) => {
    const n = scores[p.id] ?? 0;
    const lead = top > 0 && n === top;
    return h('li', { class: `score-row${lead ? ' is-lead' : ''}`, style: { '--pc': colorOf(p) } },
      h('span', { class: 'score-chip', 'aria-hidden': 'true' }),
      h('span', { class: 'score-name' }, p.name),
      lead ? h('span', { class: 'score-badge' }, t.todayTop) : null,
      h('span', { class: 'score-total' }, String(n)));
  });
  const bestItems = Object.entries(bests).filter(([id]) => byId[id] && BEST_FORMAT[id])
    .map(([id, n]) => `${byId[id].title} ${BEST_FORMAT[id](n)}`);
  return h('div', { class: 'scoreboard' },
    h('ol', { class: 'score-list' }, rows),
    bestItems.length ? h('p', { class: 'score-bests' }, `${t.teamBests} · ${bestItems.join(' · ')}`) : null);
}

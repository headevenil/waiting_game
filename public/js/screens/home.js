// Home: resume card, scoreboard, six games, and the offline / update / iOS banners.
import { h, btn } from '../ui/h.js';
import { t } from '../i18n/ko.js';
import { games, byId } from '../games/registry.js';
import { scoreboard } from '../ui/scoreboard.js';
import { currentView } from './session.js';

export function themeToggle(ctx) {
  const theme = ctx.store.state.settings.theme;
  const isNight = theme === 'night' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  return h('button', {
    type: 'button', class: 'text-btn', 'aria-label': isNight ? '낮 화면으로' : '밤 화면으로',
    onClick: () => ctx.store.dispatch({ type: 'settings/set', patch: { theme: isNight ? 'day' : 'night' } }),
  }, isNight ? '☀ ' + t.day : '☾ ' + t.night);
}

export function homeScreen(ctx) {
  const { store, sw } = ctx;
  const st = store.state;
  const rosterOk = st.roster.length >= 4;

  const banners = [];
  if (sw.updateReady) {
    banners.push(h('div', { class: 'banner banner-update' },
      h('span', {}, t.updateReady), btn(t.update, sw.applyUpdate, 'primary', { class: 'btn-small' })));
  }
  if (ctx.showIosGuide()) {
    banners.push(h('div', { class: 'banner' },
      h('div', {}, h('strong', {}, t.iosGuideTitle), h('p', { class: 'muted' }, t.iosGuideBody)),
      btn(t.close, () => store.dispatch({ type: 'settings/set', patch: { iosGuideSeen: true } }), 'secondary', { class: 'btn-small' })));
  }

  let resume = null;
  if (st.game && byId[st.game.id]) {
    const mod = byId[st.game.id];
    const v = currentView(store);
    const whose = v?.gate?.playerId ? `${st.game.state.players.find((p) => p.id === v.gate.playerId)?.name} 차례` : '';
    resume = h('button', { type: 'button', class: 'resume-card', onClick: () => ctx.go('#/play') },
      h('span', { class: 'resume-label' }, t.resumeCard),
      h('span', { class: 'resume-title' }, mod.title),
      h('span', { class: 'resume-meta' }, [v?.round, whose].filter(Boolean).join(' · ') || '진행 중'));
  }

  const roster = rosterOk
    ? h('section', { class: 'card' },
      h('div', { class: 'section-head' },
        h('h2', { class: 'section-title' }, t.rosterTitle),
        h('a', { class: 'text-btn', href: '#/roster' }, t.editRoster)),
      scoreboard({ roster: st.roster, scores: st.session.scores, bests: st.bests }))
    : h('section', { class: 'card card-cta' },
      h('p', {}, t.needRoster),
      btn(t.addRoster, () => ctx.go('#/roster'), 'primary'));

  const tiles = h('ol', { class: 'tiles' }, games.map((g, i) => h('li', {},
    h('a', { class: 'tile', href: `#/rules/${g.id}`, style: { '--i': String(i) } },
      h('span', { class: 'tile-title' }, g.title),
      h('span', { class: 'tile-line' }, g.rules[0]),
      h('span', { class: 'tile-meta' }, `${t.minutes(g.minutes)} · ${t.playersRange(g.players)}`)))));

  const surprise = btn(t.surprise, () => {
    const pick = games[Math.floor(Math.random() * games.length)];
    ctx.go(`#/rules/${pick.id}`);
  }, 'secondary');

  return h('div', { class: 'screen screen-home' },
    h('header', { class: 'topbar' },
      h('h1', { class: 'topbar-title brand' }, t.appName),
      themeToggle(ctx),
      h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': t.settings }, '⚙')),
    h('main', { class: 'main', id: 'main' },
      sw.offlineReady ? h('p', { class: 'badge badge-good' }, '✓ ' + t.offlineReady) : null,
      banners, resume, roster,
      h('section', {},
        h('h2', { class: 'section-title' }, t.pickGame),
        tiles,
        surprise)));
}

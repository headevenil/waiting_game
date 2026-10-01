// Boot, render loop, screen routing, service worker wiring.
import { createStore } from './store.js';
import { byId } from './games/registry.js';
import { loadContent } from './content.js';
import { h, runCleanups } from './ui/h.js';
import { setHaptics } from './ui/haptics.js';
import { keepAwake } from './ui/wakelock.js';
import { toast } from './ui/sheet.js';
import { homeScreen } from './screens/home.js';
import { rosterScreen } from './screens/roster.js';
import { rulesScreen } from './screens/rules.js';
import { sessionScreen, pauseIfRunning } from './screens/session.js';
import { settingsScreen } from './screens/settings.js';

const app = document.getElementById('app');

function safeStorage() {
  try { const k = '__wg'; localStorage.setItem(k, k); localStorage.removeItem(k); return localStorage; } catch { return null; }
}

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

// ---------- service worker: precache, update banner, offline badge ----------
const sw = {
  updateReady: false, offlineReady: false, version: null, reg: null, wantReload: false,
  applyUpdate() {
    if (!sw.reg?.waiting) return;
    sw.wantReload = true;
    sw.reg.waiting.postMessage('SKIP_WAITING');
  },
};

function askStatus() {
  navigator.serviceWorker?.controller?.postMessage('STATUS');
}

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    sw.reg = reg;
    // Updates are only offered on the home screen, never mid-game (and never re-render under a focused input).
    const markWaiting = () => {
      if (!reg.waiting || !navigator.serviceWorker.controller) return;
      sw.updateReady = true;
      if (route().name === 'home' || route().name === 'settings') render();
    };
    markWaiting();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed') markWaiting();
        if (nw.state === 'activated') askStatus();
      });
    });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type !== 'STATUS') return;
      const changed = sw.offlineReady !== e.data.ready || sw.version !== e.data.version;
      sw.offlineReady = e.data.ready;
      sw.version = e.data.version;
      if (changed && (route().name === 'home' || route().name === 'settings')) render();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sw.wantReload) location.reload();
      else askStatus();
    });
    await navigator.serviceWorker.ready;
    askStatus();
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  } catch { /* SW blocked (private mode, file://): the app still works online */ }
}

// ---------- routing ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  switch (parts[0]) {
    case 'roster': return { name: 'roster' };
    case 'rules': return { name: 'rules', id: parts[1] };
    case 'play': return { name: 'play' };
    case 'settings': return { name: 'settings' };
    default: return { name: 'home' };
  }
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

let store, content;
const ctx = {
  get store() { return store; },
  get content() { return content; },
  sw, go,
  rerender: () => render(),
  showIosGuide: () => isIos && !isStandalone && !store.state.settings.iosGuideSeen,
};

function applyTheme() {
  const { theme, haptics } = store.state.settings;
  if (theme === 'day' || theme === 'night') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const night = theme === 'night' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', night ? '#1B2150' : '#FFFFFF');
  setHaptics(haptics);
}

let lastRoute = null;
function render() {
  const r = route();
  if (r.name === 'play' && !store.state.game) { go('#/'); return; }
  runCleanups();
  applyTheme();
  let screen;
  switch (r.name) {
    case 'roster': screen = rosterScreen(ctx); break;
    case 'rules': screen = rulesScreen(ctx, r.id); break;
    case 'play': screen = sessionScreen(ctx); break;
    case 'settings': screen = settingsScreen(ctx); break;
    default: screen = homeScreen(ctx);
  }
  const routeKey = r.name + (r.id ?? '');
  app.replaceChildren(screen);
  if (routeKey !== lastRoute) { window.scrollTo(0, 0); lastRoute = routeKey; }
  keepAwake(r.name === 'play');
}

// ---------- boot ----------
async function boot() {
  // Reopening at any moment lands on a safe screen: always start at home.
  if (location.hash && location.hash !== '#/') history.replaceState(null, '', location.pathname + location.search);
  try {
    content = await loadContent();
  } catch {
    app.replaceChildren(h('div', { class: 'boot-error' }, h('p', {}, '단어 팩을 불러오지 못했어요.'), h('p', { class: 'muted' }, '인터넷에 한 번 연결한 뒤 다시 열어 주세요.')));
    return;
  }
  store = createStore({
    storage: safeStorage(),
    games: byId,
    getContent: () => content,
    newSeed,
  });
  store.subscribe((_, action) => {
    // Theme changes re-render anywhere; game actions re-render the play screen.
    render();
    if (action.type === 'all/reset') go('#/');
  });
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && route().name === 'play') pauseIfRunning(store);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
  render();
  const notice = store.takeNotice();
  if (notice) toast(notice);
  setupServiceWorker();
}

boot();

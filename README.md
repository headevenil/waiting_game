# 웨이팅 게임

Korean pass-the-phone party games for queues: six games on one phone, offline after the first visit.
Plain HTML, CSS and JS modules. No framework, no dependencies, no build step. The full spec is in [SPEC.md](SPEC.md).

| Game | File | Inspired by |
| --- | --- | --- |
| 라이어 찾기 | `public/js/games/liar.js` | The Chameleon |
| 마음 다이얼 | `public/js/games/dial.js` | Wavelength |
| 1부터 10까지 | `public/js/games/scale10.js` | Top Ten |
| 사라지는 힌트 | `public/js/games/fading.js` | Eraser |
| 숨은 조력자 스무고개 | `public/js/games/twenty.js` | Insider |
| 겹치면 꽝 | `public/js/games/kkwang.js` | Just One |

## Run locally

Any static server works. Service workers run on `localhost`.

```bash
python -m http.server 8787 --directory public
```

Or use Cloudflare's dev server, which also applies `_headers`:

```bash
npx wrangler dev
```

The service worker serves everything from its cache first. While you're editing, tick "Update on reload" in DevTools → Application → Service workers. You can also bump `VERSION` in `public/sw.js`.

## Test

```bash
node --test "tests/**/*.test.js"
```

```bash
python tools/lint_content.py
```

- Game reducers are pure functions: no DOM, no `Date.now()`, no `Math.random()`. Each one has a full seeded playthrough test.
- `precache.test.js` fails if a file in `public/` is missing from `FILES` in `sw.js`, or if a listed file doesn't exist.

## Content

Content lives in `public/content/*.ko.json`, one entry per line, so adding a word is a one-line change. The current packs hold 877 words in 17 categories, 150 dial spectrums and 165 1부터 10까지 themes. Run `lint_content.py` after any edit. Banned words go in `tools/banned_words.txt`.

## Display font (도현체)

Captions, names on the pass gate and secret words use BM DoHyeon (배달의민족 도현체, Woowa Brothers). The source TTF is `tools/fonts/DoHyeon-Regular.ttf`. The app ships only a subset, `public/fonts/dohyeon-sub.woff2` (~110 KB). It holds ASCII, the 2,350 common Hangul syllables (so typed player names render in it) and every character used in content and UI strings.

After changing content or copy, rebuild the subset and bump `VERSION` in `public/sw.js`:

```bash
pip install fonttools brotli
```

```bash
python tools/subset_font.py
```

## Deploy

See [DEPLOY.md](DEPLOY.md). It covers pushing to GitHub, Cloudflare Pages setup (build output `public`, no build command), updating, and the before-trip checklist.

## Icons

`python tools/make_icons.py` redraws the PNG icons. It needs Pillow.

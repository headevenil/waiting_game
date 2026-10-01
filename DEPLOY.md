# Deploying to Cloudflare Pages

웨이팅 게임 is a static site: the `public/` folder is the whole app. There's no build step, so Cloudflare Pages just serves that folder. Every push to `main` redeploys it.

## 1. Push the repo to GitHub

Run these from the `waiting-game` folder (the one containing `public/`, `tests/` and this file):

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "웨이팅 게임 v1"
```

Create an empty repository on GitHub with no README, licence or .gitignore, then connect it and push:

```bash
git remote add origin https://github.com/<your-account>/waiting-game.git
```

```bash
git push -u origin main
```

> **Private or public?** A private repo is the safer default. `tools/fonts/DoHyeon-Regular.ttf` is the full source font (BM DoHyeon, Woowa Brothers). The app only ships the small subset in `public/fonts/`. If you'd rather not publish the full TTF, add `tools/fonts/*.ttf` to `.gitignore` before the first commit. The app doesn't need it; you only need it locally to rebuild the font subset.

## 2. Create the Pages project

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/) (a free account is enough).
2. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorise GitHub and pick the `waiting-game` repository.
4. Enter these build settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | *(leave empty)* |
| Build output directory | `public` |
| Root directory | *(leave empty, unless the repo root is a parent folder; then use `waiting-game`)* |
| Environment variables | none |

5. Click **Save and Deploy**. The first deploy takes about a minute. Your site will be live at `https://<project-name>.pages.dev`.

### What Pages picks up automatically

- **`public/_headers`:** sets `noindex`, the strict Content-Security-Policy, and long caching for fonts and icons.
- **`public/robots.txt`:** blocks search engines.
- **Unknown paths serve `index.html`.** Pages does this whenever there's no `404.html`, so old or mistyped links still open the app. The app uses `#/` routes anyway.
- **`wrangler.jsonc` is ignored.** It's only for the alternative Workers deploy described at the end. If the build log says it's skipping a Wrangler config without `pages_build_output_dir`, that's expected.

## 3. Check the deploy

Open the `*.pages.dev` URL on a phone and check:

- [ ] The home screen loads and the title is in the 도현체 font.
- [ ] The **✓ 오프라인 준비 완료** badge appears after a few seconds.
- [ ] Airplane mode on, close the tab, reopen it: the app still opens.
- [ ] iPhone: Safari → Share → **홈 화면에 추가**. Android: Chrome menu → **홈 화면에 추가**. The app opens full-screen from the icon.

In desktop Chrome DevTools, **Network** should show no requests to other domains, and **Application → Service workers** should show `sw.js` activated.

## 4. Updating the app

Every push to `main` deploys automatically. Pushes to other branches get their own preview URL, which is handy for testing a change before merging.

**Before every deploy:**

1. Run the checks:

   ```bash
   node --test "tests/**/*.test.js"
   ```

   ```bash
   python tools/lint_content.py
   ```

2. If you changed any Korean text (content JSON or UI strings), rebuild the font subset so new syllables render in 도현체:

   ```bash
   python tools/subset_font.py
   ```

3. **Bump `VERSION` in `public/sw.js`** (for example `wg-2026-10-01f` → `wg-2026-10-02a`). Phones only download a new version when this string changes. If you forget, people keep the old cached app.

4. Commit and push.

Phones don't update mid-game. The new version downloads in the background and the home screen shows **새 버전이 있어요 · 업데이트** until someone taps it.

**Before a trip:** deploy, open the app on every phone over Wi-Fi, wait for **오프라인 준비 완료**, then stop pushing until you're home.

## 5. Optional extras

- **Custom domain:** Pages project → **Custom domains** → **Set up a domain**. A domain already on Cloudflare takes a minute; others need a CNAME record. HTTPS is automatic.
- **Keep it private:** the site is unlisted (`noindex`) but anyone with the link can open it. To lock it to your group, put the project behind **Cloudflare Access** (Zero Trust, free for up to 50 users). Access needs a login, so phones must open the app once while online after the login expires.
- **Rollback:** Pages project → **Deployments** → pick an older deployment → **Rollback to this deployment**. Bump `VERSION` in your next real fix so phones move off the bad build.

## Alternative: Workers static assets

The repo also works as a Worker with static assets. This is Cloudflare's newer path, and `wrangler.jsonc` is already set up for it. From the repo root:

```bash
npx wrangler login
```

```bash
npx wrangler deploy
```

That publishes to `https://waiting-game.<your-subdomain>.workers.dev`. You can also connect the GitHub repo to the Worker in the dashboard (**Workers & Pages** → your Worker → **Settings** → **Build**) to get push-to-deploy. Pick one setup, Pages or Workers, so you don't end up with two live copies.

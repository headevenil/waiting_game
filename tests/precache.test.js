import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
// Served by Cloudflare but not part of the app shell: config files and the worker itself.
const NOT_CACHED = new Set(['/sw.js', '/_headers', '/robots.txt']);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : ['/' + relative(PUBLIC, p).split(sep).join('/')];
  });
}

const sw = readFileSync(join(PUBLIC, 'sw.js'), 'utf8');
const listed = new Set([...sw.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]));

test('every file in public/ is listed in sw.js', () => {
  const missing = walk(PUBLIC).filter((f) => !NOT_CACHED.has(f) && !listed.has(f));
  assert.deepEqual(missing, [], `add to FILES in public/sw.js: ${missing.join(', ')}`);
});

test('every listed file exists (a missing one breaks the whole install)', () => {
  const ghosts = [...listed].filter((f) => f !== '/' && !existsSync(join(PUBLIC, f)));
  assert.deepEqual(ghosts, []);
});

test('index.html uses no inline scripts or style attributes (strict CSP)', () => {
  const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'inline <script>');
  assert.ok(!/\sstyle=/i.test(html), 'style attribute');
});

test('no JS sets a style="" attribute string (blocked by CSP)', () => {
  const offenders = walk(join(PUBLIC, 'js')).filter((f) => /setAttribute\(\s*['"]style['"]|\.style\.cssText|style="/.test(readFileSync(join(PUBLIC, f.slice(1)), 'utf8')));
  assert.deepEqual(offenders, []);
});

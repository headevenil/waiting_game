// Content packs: load + index (browser), and a pure draw-without-repeats used by reducers.
import { shuffle } from './games/common.js';

// Draw `n` items, skipping ids in `recentIds` (oldest first). When the pool runs dry,
// the oldest half of the buffer is released until enough items are available.
export function draw(r, pool, n, recentIds = []) {
  let recent = recentIds.slice();
  const avail = () => { const set = new Set(recent); return pool.filter((x) => !set.has(x.id)); };
  let a = avail();
  while (a.length < n && recent.length) {
    recent = recent.slice(Math.ceil(recent.length / 2));
    a = avail();
  }
  return shuffle(r, a).slice(0, n);
}

// Push used ids onto a ring buffer (200 max), newest last.
export function remember(buffer = [], ids = [], max = 200) {
  const set = new Set(ids);
  return [...buffer.filter((id) => !set.has(id)), ...ids].slice(-max);
}

export function categories(words) {
  return [...new Set(words.map((w) => w.cat))];
}

export async function loadContent(base = '/content/') {
  const get = (f) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
  const [w, d, s] = await Promise.all([get('words.ko.json'), get('spectrums.ko.json'), get('scales.ko.json')]);
  return { words: w.words, spectrums: d.spectrums, scales: s.scales };
}

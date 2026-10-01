// Normalise Korean words for comparison: NFC, lower case, no spaces/punctuation/emoji.
// Particles are deliberately NOT stripped (고양이 ends in 이).
export const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase()
  .replace(/[\s\p{P}\p{S}]/gu, '');

// True if `guess` matches `answer` or one of its aliases after norm().
export function same(guess, answer, aliases = []) {
  const g = norm(guess);
  if (!g) return false;
  return [answer, ...aliases].some((a) => norm(a) === g);
}

// True if `text` contains the answer or an alias (used to reject clues that give it away).
export function contains(text, answer, aliases = []) {
  const t = norm(text);
  return [answer, ...aliases].some((a) => { const n = norm(a); return n && t.includes(n); });
}

// Length in characters (Hangul syllables count as one).
export const len = (s) => [...String(s ?? '').normalize('NFC')].length;

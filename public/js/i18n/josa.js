// Particle (조사) helper: picks the right particle for the word's final consonant.
// Pairs: '이/가' '을/를' '은/는' '과/와' '아/야' '으로/로' '이에요/예요'
export function josa(word, pair) {
  const last = String(word).trim().at(-1) ?? '';
  const code = last.charCodeAt(0) - 0xac00;
  const [withFinal, noFinal] = pair.split('/');
  if (!(code >= 0 && code <= 11171)) return word + '(' + withFinal + ')' + noFinal; // non-Hangul name
  const final = code % 28;                       // 0 = no final consonant (받침)
  if (pair === '으로/로' && (final === 0 || final === 8)) return word + '로'; // ㄹ takes 로
  return word + (final ? withFinal : noFinal);
}
// josa('민지','아/야') → '민지야'   josa('준혁','아/야') → '준혁아'

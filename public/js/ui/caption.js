// The signature 예능 자막 caption. One per screen, only on reveals and results.
import { h } from './h.js';
import { buzz, HAPTIC } from './haptics.js';

export function caption(text, tone) {
  if (tone === 'good') buzz(HAPTIC.correct);
  return h('p', { class: 'caption', role: 'status', 'aria-live': 'polite' }, text);
}

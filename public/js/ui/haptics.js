// Vibration on Android; iOS web has no navigator.vibrate, so this silently does nothing there.
let enabled = true;
export const setHaptics = (on) => { enabled = !!on; };

export const HAPTIC = { turn: 15, timeUp: [80, 60, 80], correct: [20, 40, 20], tick: 5 };

export function buzz(pattern) {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

// Ordered list of games for the home screen.
import liar from './liar.js';
import dial from './dial.js';
import scale10 from './scale10.js';
import fading from './fading.js';
import twenty from './twenty.js';
import kkwang from './kkwang.js';

export const games = [liar, dial, scale10, fading, twenty, kkwang];
export const byId = Object.fromEntries(games.map((g) => [g.id, g]));

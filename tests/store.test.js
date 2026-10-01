import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, migrate, STORAGE_KEY, SCHEMA } from '../public/js/store.js';
import { byId } from '../public/js/games/registry.js';
import { P5, C, memoryStorage } from './fixtures.js';

const make = (storage = memoryStorage()) =>
  createStore({ storage, games: byId, getContent: () => C, newSeed: () => 42, now: () => 1_790_000_000_000 });

test('save → reload round-trip', () => {
  const storage = memoryStorage();
  const a = make(storage);
  a.dispatch({ type: 'roster/set', players: P5 });
  a.dispatch({ type: 'game/start', gameId: 'liar', options: { mode: '일반' } });
  a.dispatch({ type: 'PEEKED', playerId: 'p1' });
  const b = make(storage);
  assert.deepEqual(b.state, a.state);
  assert.equal(b.state.game.state.turn, 1);
});

test('migration from schema 0', () => {
  const old = { players: [{ name: '민지' }, { name: '준혁' }], scores: { 민지: 3 } };
  const s = migrate(old);
  assert.equal(s.schema, SCHEMA);
  assert.deepEqual(s.roster.map((p) => p.name), ['민지', '준혁']);
  assert.equal(s.session.scores.p1, 3);
  assert.equal(s.game, null);
});

test('unreadable data resets with a notice', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{nope');
  const s = make(storage);
  assert.deepEqual(s.state.roster, []);
  assert.ok(s.takeNotice());
});

test('undo restores exactly, up to 10 steps', () => {
  const s = make();
  s.dispatch({ type: 'roster/set', players: P5 });
  s.dispatch({ type: 'game/start', gameId: 'liar', options: {} });
  const before = s.state;
  s.dispatch({ type: 'PEEKED', playerId: 'p1' });
  s.dispatch({ type: 'undo' });
  assert.deepEqual(s.state, before);
  assert.ok(!s.canUndo());
});

test('unknown actions change nothing and are not saved to undo', () => {
  const s = make();
  s.dispatch({ type: 'roster/set', players: P5 });
  s.dispatch({ type: 'game/start', gameId: 'liar', options: {} });
  const before = s.state;
  s.dispatch({ type: 'NOPE' });
  assert.equal(s.state, before);
  assert.ok(!s.canUndo());
});

test('finished game adds points once; undo removes them', () => {
  const s = make();
  s.dispatch({ type: 'roster/set', players: P5 });
  s.dispatch({ type: 'game/start', gameId: 'liar', options: {} });
  for (const p of P5) s.dispatch({ type: 'PEEKED', playerId: p.id });
  s.dispatch({ type: 'START_VOTE' });
  const liarId = s.state.game.state.liarId;
  const wrong = P5.find((p) => p.id !== liarId).id;
  s.dispatch({ type: 'ACCUSE', playerId: wrong });
  assert.equal(s.state.session.scores[liarId], 3);
  assert.equal(s.state.session.rounds.length, 1);
  s.dispatch({ type: 'undo' });
  assert.equal(s.state.session.scores[liarId] ?? 0, 0);
});

test('fair rotation: liar counts are tracked and recent words remembered', () => {
  const s = make();
  s.dispatch({ type: 'roster/set', players: P5 });
  s.dispatch({ type: 'game/start', gameId: 'liar', options: {} });
  const id = s.state.game.state.liarId;
  assert.equal(s.state.fairness.liar[id], 1);
  assert.ok(s.state.recent.words.includes(s.state.game.state.wordId));
  s.dispatch({ type: 'game/again' });
  assert.notEqual(s.state.game.state.liarId, id);  // fewest-turns rule
});

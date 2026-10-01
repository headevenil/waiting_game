import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, same, contains, len } from '../public/js/i18n/norm.js';

test('NFC and NFD input match', () => {
  const nfd = '떡볶이'.normalize('NFD');
  assert.notEqual(nfd, '떡볶이');
  assert.equal(norm(nfd), norm('떡볶이'));
});

test('spaces, punctuation and emoji are ignored', () => {
  assert.equal(norm(' 떡 볶이!? '), '떡볶이');
  assert.equal(norm('떡볶이😋'), '떡볶이');
  assert.equal(norm('Ice Cream'), 'icecream');
});

test('particles are not stripped', () => {
  assert.equal(norm('고양이'), '고양이');
  assert.notEqual(norm('사과를'), norm('사과'));
});

test('same() accepts aliases', () => {
  assert.ok(same('떡뽁이', '떡볶이', ['떡뽁이']));
  assert.ok(!same('순대', '떡볶이', ['떡뽁이']));
  assert.ok(!same('', '떡볶이'));
});

test('contains() finds the answer inside a clue', () => {
  assert.ok(contains('매운떡볶이', '떡볶이'));
  assert.ok(!contains('매운맛', '떡볶이'));
});

test('len counts syllables', () => {
  assert.equal(len('떡볶이'), 3);
  assert.equal(len('떡볶이'.normalize('NFD')), 3);
});

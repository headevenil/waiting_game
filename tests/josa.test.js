import test from 'node:test';
import assert from 'node:assert/strict';
import { josa } from '../public/js/i18n/josa.js';

test('vocative 아/야', () => {
  assert.equal(josa('민지', '아/야'), '민지야');
  assert.equal(josa('준혁', '아/야'), '준혁아');
});

test('subject 이/가 and object 을/를', () => {
  assert.equal(josa('민지', '이/가'), '민지가');
  assert.equal(josa('준혁', '이/가'), '준혁이');
  assert.equal(josa('민지', '을/를'), '민지를');
  assert.equal(josa('준혁', '을/를'), '준혁을');
});

test('으로/로 with ㄹ final', () => {
  assert.equal(josa('서울', '으로/로'), '서울로');
  assert.equal(josa('부산', '으로/로'), '부산으로');
  assert.equal(josa('물', '으로/로'), '물로');
  assert.equal(josa('바다', '으로/로'), '바다로');
});

test('copula 이에요/예요', () => {
  assert.equal(josa('민지', '이에요/예요'), '민지예요');
  assert.equal(josa('준혁', '이에요/예요'), '준혁이에요');
});

test('non-Hangul fallback shows both forms', () => {
  assert.equal(josa('Tom', '이/가'), 'Tom(이)가');
  assert.equal(josa('', '은/는'), '(은)는');
});

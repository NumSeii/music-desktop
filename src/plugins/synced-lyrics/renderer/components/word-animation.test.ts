import { test, expect } from '@playwright/test';

import {
  glowAnimation,
  splitLetters,
  sweepDuration,
  wordProgress,
} from './word-animation';

test('the sweep uses 90% of the word duration', () => {
  expect(sweepDuration(1000)).toBe(900);
  expect(sweepDuration(120)).toBe(108);
  expect(sweepDuration(1392)).toBe(1253);
});

test('the sweep never has a negative duration', () => {
  expect(sweepDuration(0)).toBe(0);
  expect(sweepDuration(-50)).toBe(0);
});

test('letters are split by grapheme, not by code unit', () => {
  expect(splitLetters('não')).toEqual(['n', 'ã', 'o']);
  // "a" followed by a combining tilde is still a single letter.
  expect(splitLetters('na\u0303o')).toEqual(['n', 'a\u0303', 'o']);
  expect(splitLetters('你好')).toEqual(['你', '好']);
  expect(splitLetters('👍🏽')).toHaveLength(1);
  expect(splitLetters('')).toEqual([]);
});

test('a word has not started sweeping before its start', () => {
  expect(wordProgress(-10, 1000)).toBe(0);
  expect(wordProgress(0, 1000)).toBe(0);
});

test('the sweep grows linearly over 90% of the word', () => {
  expect(wordProgress(225, 1000)).toBe(0.25);
  expect(wordProgress(450, 1000)).toBe(0.5);
  expect(wordProgress(900, 1000)).toBe(1);
});

test('the sweep is done before the word ends, and stays done', () => {
  expect(wordProgress(950, 1000)).toBe(1);
  expect(wordProgress(5000, 1000)).toBe(1);
});

test('a word without duration is fully lit as soon as it starts', () => {
  expect(wordProgress(-1, 0)).toBe(0);
  expect(wordProgress(0, 0)).toBe(1);
  expect(wordProgress(50, 0)).toBe(1);
});

test('glow and wobble only exist for the fancy effect', () => {
  expect(glowAnimation(1000, false)).toBe('none');
  expect(glowAnimation(1000, true)).toBe(
    'lyrics-glow 1000ms forwards, lyrics-wobble 500ms forwards',
  );
});

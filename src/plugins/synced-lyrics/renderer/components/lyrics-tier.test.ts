import { test, expect } from '@playwright/test';

import { lyricsTier } from './lyrics-tier';

import type { LineLyrics, LyricResult } from '../../types';

const line = (overrides: Partial<LineLyrics> = {}): LineLyrics => ({
  time: '00:01.00',
  timeInMs: 1000,
  duration: 1000,
  text: 'la',
  status: 'upcoming',
  ...overrides,
});

const word = { timeInMs: 1000, duration: 500, word: 'la', space: false };

const result = (overrides: Partial<LyricResult> = {}): LyricResult => ({
  title: 'Song',
  artists: ['Artist'],
  ...overrides,
});

test('no lyrics at all', () => {
  expect(lyricsTier(null)).toBe(0);
  expect(lyricsTier(undefined)).toBe(0);
  expect(lyricsTier(result())).toBe(0);
  expect(lyricsTier(result({ lines: [], lyrics: '' }))).toBe(0);
});

test('plain lyrics', () => {
  expect(lyricsTier(result({ lyrics: 'la la la' }))).toBe(1);
});

test('line-synced lyrics', () => {
  expect(lyricsTier(result({ lines: [line()] }))).toBe(2);
});

test('word-synced lyrics', () => {
  const lines = [line(), line({ words: [word] })];
  expect(lyricsTier(result({ lines }))).toBe(3);
});

test('empty word lists do not make a line word-synced', () => {
  expect(lyricsTier(result({ lines: [line({ words: [] })] }))).toBe(2);
});

test('better lyrics win even when plain lyrics come along', () => {
  const lines = [line({ words: [word] })];
  expect(lyricsTier(result({ lines, lyrics: 'la' }))).toBe(3);
  expect(lyricsTier(result({ lines: [line()], lyrics: 'la' }))).toBe(2);
});

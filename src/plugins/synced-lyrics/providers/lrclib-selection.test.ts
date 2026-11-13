import { test, expect } from '@playwright/test';

import { pickRecord, type LRCLibRecord } from './lrclib-selection';

const SONG_DURATION = 200;
const LINE_SYNCED = '[00:01.00]la';
const LYRICSFILE = `\
lines:
- text: la
  start_ms: 1000
  words:
  - text: la
    start_ms: 1000
`;

const record = (
  id: number,
  overrides: Partial<LRCLibRecord> = {},
): LRCLibRecord => ({
  id,
  name: 'Song',
  trackName: 'Song',
  artistName: 'Artist',
  albumName: 'Album',
  duration: SONG_DURATION,
  instrumental: false,
  plainLyrics: '',
  syncedLyrics: '',
  ...overrides,
});

test('there is nothing to pick from an empty list', () => {
  expect(pickRecord([], SONG_DURATION)).toBeNull();
});

test('a record that is too far from the song is rejected', () => {
  const records = [record(1, { duration: 216, syncedLyrics: LINE_SYNCED })];
  expect(pickRecord(records, SONG_DURATION)).toBeNull();
});

test('an instrumental closest record gives nothing', () => {
  const records = [record(1, { instrumental: true, plainLyrics: 'plain' })];
  expect(pickRecord(records, SONG_DURATION)).toBeNull();
});

test('word-synced beats a closer line-synced record', () => {
  const records = [
    record(1, { duration: 200, syncedLyrics: LINE_SYNCED }),
    record(2, {
      duration: 201.5,
      syncedLyrics: LINE_SYNCED,
      hasWordSync: true,
      lyricsfile: LYRICSFILE,
    }),
  ];

  const picked = pickRecord(records, SONG_DURATION);
  expect(picked?.record.id).toBe(2);
  // The silence before the first line has no words, so look for the sung one.
  const sung = picked?.wordLines?.find((line) => line.words?.length);
  expect(sung?.words).toHaveLength(1);
});

test('a word-synced record that is too far is skipped', () => {
  const records = [
    record(1, { duration: 200, syncedLyrics: LINE_SYNCED }),
    record(2, {
      duration: 203,
      syncedLyrics: LINE_SYNCED,
      hasWordSync: true,
      lyricsfile: LYRICSFILE,
    }),
  ];

  const picked = pickRecord(records, SONG_DURATION);
  expect(picked?.record.id).toBe(1);
  expect(picked?.wordLines).toBeNull();
});

test('an unreadable lyricsfile falls back to line-synced', () => {
  const records = [
    record(1, {
      syncedLyrics: LINE_SYNCED,
      hasWordSync: true,
      lyricsfile: 'lines: [',
    }),
  ];

  const picked = pickRecord(records, SONG_DURATION);
  expect(picked?.record.id).toBe(1);
  expect(picked?.wordLines).toBeNull();
});

test('an instrumental word-synced record is ignored', () => {
  const records = [
    record(1, { duration: 200, syncedLyrics: LINE_SYNCED }),
    record(2, {
      duration: 200.5,
      instrumental: true,
      hasWordSync: true,
      lyricsfile: LYRICSFILE,
    }),
  ];

  expect(pickRecord(records, SONG_DURATION)?.record.id).toBe(1);
});

test('line-synced beats a closer plain-only record', () => {
  const records = [
    record(1, { duration: 200, plainLyrics: 'plain' }),
    record(2, { duration: 205, syncedLyrics: LINE_SYNCED }),
  ];

  const picked = pickRecord(records, SONG_DURATION);
  expect(picked?.record.id).toBe(2);
  expect(picked?.wordLines).toBeNull();
});

test('plain lyrics are the last resort', () => {
  const records = [record(1, { plainLyrics: 'plain' })];

  const picked = pickRecord(records, SONG_DURATION);
  expect(picked?.record.id).toBe(1);
  expect(picked?.wordLines).toBeNull();
});

test('a record without any lyrics gives nothing', () => {
  expect(pickRecord([record(1)], SONG_DURATION)).toBeNull();
});

import { test, expect } from '@playwright/test';

import { Lyricsfile } from './lyricsfile';

test('word-synced lines', () => {
  const lines = Lyricsfile.parse(`\
version: '1.0'
metadata:
  title: Synthetic Song
  duration_ms: 40000
lines:
- text: Yeah
  start_ms: 13120
  end_ms: 14551
  words:
  - text: Yeah
    start_ms: 13159
- text: I've been call
  start_ms: 27170
  end_ms: 28268
  words:
  - text: 'I''ve '
    start_ms: 27209
  - text: 'been '
    start_ms: 27598
  - text: call
    start_ms: 28200
- text: '♪'
  start_ms: 29000
- text: 'Você não: tá # aí'
  start_ms: 30000
  end_ms: 31000
  words:
  - text: 'Você '
    start_ms: 30000
  - text: 'não: '
    start_ms: 30400
  - text: 'tá # aí'
    start_ms: 30700
`);

  expect(lines).toEqual([
    // The song starts with a silence, like the plain LRC parser does.
    {
      time: '00:00.00',
      timeInMs: 0,
      duration: 13120,
      text: '',
      status: 'upcoming',
    },
    {
      time: '00:13.12',
      timeInMs: 13120,
      duration: 14050,
      text: 'Yeah',
      status: 'upcoming',
      // The only word ends where its line ends.
      words: [{ timeInMs: 13159, duration: 1392, word: 'Yeah', space: false }],
    },
    {
      time: '00:27.17',
      timeInMs: 27170,
      duration: 1830,
      text: "I've been call",
      status: 'upcoming',
      words: [
        { timeInMs: 27209, duration: 389, word: "I've", space: true },
        { timeInMs: 27598, duration: 602, word: 'been', space: true },
        { timeInMs: 28200, duration: 68, word: 'call', space: false },
      ],
    },
    // A "♪" line is shown as an empty line, like the YouTube Music provider.
    {
      time: '00:29.00',
      timeInMs: 29000,
      duration: 1000,
      text: '',
      status: 'upcoming',
    },
    {
      time: '00:30.00',
      timeInMs: 30000,
      duration: 1000,
      text: 'Você não: tá # aí',
      status: 'upcoming',
      words: [
        { timeInMs: 30000, duration: 400, word: 'Você', space: true },
        { timeInMs: 30400, duration: 300, word: 'não:', space: true },
        { timeInMs: 30700, duration: 300, word: 'tá # aí', space: false },
      ],
    },
  ]);
});

test('invalid or unexpected input falls back to null', () => {
  expect(Lyricsfile.parse('')).toBeNull();
  expect(Lyricsfile.parse('lines: [')).toBeNull();
  expect(Lyricsfile.parse("version: '1.0'")).toBeNull();
  expect(Lyricsfile.parse('lines: []')).toBeNull();
  expect(Lyricsfile.parse('lines:\n- text: 5\n  start_ms: 1')).toBeNull();
});

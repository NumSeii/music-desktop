import { test, expect } from '@playwright/test';

import { LRC } from './lrc';

test('empty string', () => {
  const lrc = LRC.parse('');
  expect(lrc).toStrictEqual({ lines: [], tags: [] });
});

test('chorus', () => {
  const lrc = LRC.parse(`\
[00:12.00]Line 1 lyrics
[00:17.20]Line 2 lyrics
[00:21.10][00:45.10]Repeating lyrics (e.g. chorus)
[mm:ss.xx]Last lyrics line\
`);

  expect(lrc).toStrictEqual({
    lines: [
      { duration: 12000, text: '', words: [], time: '00:00:00', timeInMs: 0 },
      {
        duration: 5200,
        text: 'Line 1 lyrics',
        words: [],
        time: '00:12:00',
        timeInMs: 12000,
      },
      {
        duration: 3900,
        text: 'Line 2 lyrics',
        words: [],
        time: '00:17:20',
        timeInMs: 17200,
      },
      {
        duration: 24000,
        text: 'Repeating lyrics (e.g. chorus)',
        words: [],
        time: '00:21:10',
        timeInMs: 21100,
      },
      {
        duration: Infinity,
        text: 'Repeating lyrics (e.g. chorus)',
        words: [],
        time: '00:45:10',
        timeInMs: 45100,
      },
    ],
    tags: [],
  });
});

test('attributes', () => {
  const lrc = LRC.parse(
    `[ar:Chubby Checker oppure  Beatles, The]
[al:Hits Of The 60's - Vol. 2 – Oldies]
[ti:Let's Twist Again]
[au:Written by Kal Mann / Dave Appell, 1961]
[length: 2:23]

[00:12.00]Naku Penda Piya-Naku Taka Piya-Mpenziwe
[00:15.30]Some more lyrics ...`,
  );

  expect(lrc).toStrictEqual({
    lines: [
      { duration: 12000, text: '', words: [], time: '00:00:00', timeInMs: 0 },
      {
        duration: 3300,
        text: 'Naku Penda Piya-Naku Taka Piya-Mpenziwe',
        words: [],
        time: '00:12:00',
        timeInMs: 12000,
      },
      {
        duration: Infinity,
        text: 'Some more lyrics ...',
        words: [],
        time: '00:15:30',
        timeInMs: 15300,
      },
    ],
    tags: [
      { tag: 'ar', value: 'Chubby Checker oppure  Beatles, The' },
      { tag: 'al', value: "Hits Of The 60's - Vol. 2 – Oldies" },
      { tag: 'ti', value: "Let's Twist Again" },
      { tag: 'au', value: 'Written by Kal Mann / Dave Appell, 1961' },
      { tag: 'length', value: '2:23' },
    ],
  });
});

test('karaoke', () => {
  const lrc = LRC.parse(
    '[00:00.00] <00:00.04> When <00:00.16> the <00:00.82> truth <00:01.29> is <00:01.63> found <00:03.09> to <00:03.37> be <00:05.92> lies',
  );

  expect(lrc).toStrictEqual({
    lines: [
      {
        duration: Infinity,
        text: 'When the truth is found to be lies',
        time: '00:00:00',
        timeInMs: 0,
        words: [
          { timeInMs: 40, duration: 120, word: 'When', space: true },
          { timeInMs: 160, duration: 660, word: 'the', space: true },
          { timeInMs: 820, duration: 470, word: 'truth', space: true },
          { timeInMs: 1290, duration: 340, word: 'is', space: true },
          { timeInMs: 1630, duration: 1460, word: 'found', space: true },
          { timeInMs: 3090, duration: 280, word: 'to', space: true },
          { timeInMs: 3370, duration: 2550, word: 'be', space: true },
          // The last word has no end marker and no next line.
          { timeInMs: 5920, duration: 1000, word: 'lies', space: false },
        ],
      },
    ],
    tags: [],
  });
});

test('karaoke keeps accents, apostrophes and CJK, and honours end markers', () => {
  const lrc = LRC.parse(`\
[00:10.00]<00:10.00>Você <00:10.50>não <00:11.00>don't <00:11.40>
[00:12.00]<00:12.00>你<00:12.20>好<00:12.50>`);

  expect(lrc).toStrictEqual({
    lines: [
      { duration: 10000, text: '', words: [], time: '00:00:00', timeInMs: 0 },
      {
        duration: 2000,
        text: "Você não don't",
        time: '00:10:00',
        timeInMs: 10000,
        words: [
          { timeInMs: 10000, duration: 500, word: 'Você', space: true },
          { timeInMs: 10500, duration: 500, word: 'não', space: true },
          // `<00:11.40>` has no word after it: it ends "don't".
          { timeInMs: 11000, duration: 400, word: "don't", space: false },
        ],
      },
      {
        duration: Infinity,
        text: '你好',
        time: '00:12:00',
        timeInMs: 12000,
        words: [
          { timeInMs: 12000, duration: 200, word: '你', space: false },
          { timeInMs: 12200, duration: 300, word: '好', space: false },
        ],
      },
    ],
    tags: [],
  });
});

test('offset shifts lines and words together', () => {
  const lrc = LRC.parse(`\
[offset: 500]
[00:01.00]<00:01.00>one <00:01.50>two
[00:03.00]<00:03.00>three`);

  expect(lrc).toStrictEqual({
    lines: [
      { duration: 1500, text: '', words: [], time: '00:00:00', timeInMs: 0 },
      {
        duration: 2000,
        text: 'one two',
        time: '00:01:00',
        timeInMs: 1500,
        words: [
          { timeInMs: 1500, duration: 500, word: 'one', space: true },
          // Ends where the next line starts, both already shifted.
          { timeInMs: 2000, duration: 1500, word: 'two', space: false },
        ],
      },
      {
        duration: Infinity,
        text: 'three',
        time: '00:03:00',
        timeInMs: 3500,
        words: [
          { timeInMs: 3500, duration: 1000, word: 'three', space: false },
        ],
      },
    ],
    tags: [],
  });
});

test('a repeated karaoke line falls back to line-level timing', () => {
  const lrc = LRC.parse('[00:05.00][00:15.00]<00:05.00>la <00:05.50>la');

  expect(
    lrc.lines.map(({ text, timeInMs, words }) => ({ text, timeInMs, words })),
  ).toStrictEqual([
    { text: '', timeInMs: 0, words: [] },
    { text: 'la la', timeInMs: 5000, words: [] },
    { text: 'la la', timeInMs: 15000, words: [] },
  ]);
});

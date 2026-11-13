import { parse as parseYaml } from 'yaml';
import * as z from 'zod';

import type { LineLyrics, LineWord } from '../types';

/**
 * The "Lyricsfile" format LRCLib uses for lyrics with word-level timing
 * (`hasWordSync: true`). It is YAML, and the format is still young, so
 * everything is validated and anything unexpected makes `parse` return `null`,
 * letting the caller fall back to the plain line-level lyrics.
 *
 * Example (words carry their own trailing space and have no end time):
 *
 *   lines:
 *   - text: I've been tryna call
 *     start_ms: 27170
 *     end_ms: 28268
 *     words:
 *     - text: "I've "
 *       start_ms: 27209
 *     - text: call
 *       start_ms: 28200
 */
const WordSchema = z.object({
  text: z.string(),
  start_ms: z.number(),
});

const LineSchema = z.object({
  text: z.string(),
  start_ms: z.number(),
  end_ms: z.number().nullish(),
  words: z.array(WordSchema).nullish(),
});

const LyricsfileSchema = z.object({
  lines: z.array(LineSchema),
});

// Used when neither the line nor the next line says when something ends.
const FALLBACK_DURATION = 1000;

const millisToTime = (millis: number) => {
  const minutes = Math.floor(millis / 60000);
  const remainder = millis % 60000;
  const seconds = Math.floor(remainder / 1000);
  const centiseconds = Math.floor((remainder % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

export const Lyricsfile = {
  parse: (raw: string): LineLyrics[] | null => {
    let data: unknown;
    try {
      data = parseYaml(raw);
    } catch {
      return null;
    }

    const result = LyricsfileSchema.safeParse(data);
    if (!result.success || !result.data.lines.length) return null;

    const sorted = [...result.data.lines].sort(
      ({ start_ms: a }, { start_ms: b }) => a - b,
    );

    const lines = sorted.map((line, index): LineLyrics => {
      const next = sorted[index + 1];
      const lineEnd =
        line.end_ms ?? next?.start_ms ?? line.start_ms + FALLBACK_DURATION;

      const timed = (line.words ?? []).filter(({ text }) => text.trim());
      const words = timed.map((word, idx): LineWord => {
        const nextWord = timed[idx + 1];

        return {
          timeInMs: word.start_ms,
          duration: Math.max(
            0,
            (nextWord?.start_ms ?? lineEnd) - word.start_ms,
          ),
          word: word.text.trim(),
          space:
            !!nextWord && (/\s$/.test(word.text) || /^\s/.test(nextWord.text)),
        };
      });

      const text = line.text.trim();

      return {
        time: millisToTime(line.start_ms),
        timeInMs: line.start_ms,
        // Like the plain LRC parser: a line lasts until the next one starts.
        duration: next
          ? next.start_ms - line.start_ms
          : Math.max(0, lineEnd - line.start_ms),
        text: text === '♪' ? '' : text,
        words: words.length ? words : undefined,
        status: 'upcoming',
      };
    });

    const first = lines[0];
    if (first.timeInMs > 300) {
      lines.unshift({
        time: '00:00.00',
        timeInMs: 0,
        duration: first.timeInMs,
        text: '',
        status: 'upcoming',
      });
    }

    return lines;
  },
};

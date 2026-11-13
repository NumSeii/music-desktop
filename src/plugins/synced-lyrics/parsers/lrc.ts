interface LRCTag {
  tag: string;
  value: string;
}

export interface LRCWord {
  timeInMs: number;
  duration: number;
  word: string;
  /** Whether a space separates this word from the next one. */
  space: boolean;
}

interface LRCLine {
  time: string;
  timeInMs: number;
  duration: number;
  text: string;
  words: LRCWord[];
}

interface LRC {
  tags: LRCTag[];
  lines: LRCLine[];
}

const tagRegex = /^\[(?<tag>\w+):\s*(?<value>.+?)\s*\]$/;
// prettier-ignore
const timestampRegex = /^\[(?<minutes>\d+):(?<seconds>\d+)\.(?<centiseconds>\d+)\]/m;

// Enhanced LRC (A2) word tag, e.g. `<00:01.29>`. The text up to the next tag is the word.
// prettier-ignore
const wordTagRegex = /<(?<minutes>\d+):(?<seconds>\d+)\.(?<centiseconds>\d+)>/g;

// Used when the last word of the last line has no end marker and no next line.
const FALLBACK_WORD_DURATION = 1000;

// prettier-ignore
const toMs = (minutes: string, seconds: string, centiseconds: string) =>
  ((parseInt(minutes) * 60) * 1000) +
  (parseInt(seconds) * 1000) +
  parseInt(centiseconds.padEnd(3, '0'));

interface RawWord {
  timeInMs: number;
  word: string;
  space: boolean;
  /** Explicit end of the word, from a trailing `<mm:ss.xx>` tag. */
  endInMs?: number;
}

/**
 * Splits a line carrying word tags into its plain text and its timed words.
 * Works on any script, a word is simply everything up to the next tag.
 */
const parseWords = (line: string): { text: string; words: RawWord[] } => {
  const tags = Array.from(line.matchAll(wordTagRegex));
  if (!tags.length) return { text: line.trim(), words: [] };

  const words: RawWord[] = [];
  const raws: string[] = [];

  for (let i = 0; i < tags.length; i++) {
    const { groups, index } = tags[i];
    const { minutes, seconds, centiseconds } = groups!;
    const timeInMs = toMs(minutes, seconds, centiseconds);

    const start = index + tags[i][0].length;
    const end = tags[i + 1]?.index ?? line.length;
    const raw = line.slice(start, end);

    // A tag with no text after it marks where the previous word ends.
    if (!raw.trim()) {
      const previous = words.at(-1);
      if (previous && previous.endInMs === undefined) {
        previous.endInMs = timeInMs;
        raws[raws.length - 1] += raw;
      }
      continue;
    }

    words.push({ timeInMs, word: raw.trim(), space: false });
    raws.push(raw);
  }

  for (let i = 0; i < words.length - 1; i++) {
    words[i].space = /\s$/.test(raws[i]) || /^\s/.test(raws[i + 1]);
  }

  const text = line.replace(wordTagRegex, '').replace(/\s+/g, ' ').trim();
  return { text, words };
};

export const LRC = {
  parse: (text: string): LRC => {
    const lrc: LRC = {
      tags: [],
      lines: [],
    };

    let offset = 0;
    const rawWords = new Map<LRCLine, RawWord[]>();

    for (let line of text.split('\n')) {
      line = line.trim();
      if (!line.startsWith('[')) continue;

      const timestamps = [];
      let match: Record<string, string> | undefined;
      while ((match = line.match(timestampRegex)?.groups)) {
        const { minutes, seconds, centiseconds } = match;
        const timeInMs = toMs(minutes, seconds, centiseconds);

        timestamps.push({
          time: `${minutes}:${seconds}:${centiseconds}`,
          timeInMs,
        });

        line = line.replace(timestampRegex, '');
      }

      if (!timestamps.length) {
        const tag = line.match(tagRegex)?.groups;
        if (tag) {
          if (tag.tag === 'offset') {
            offset = parseInt(tag.value);
            continue;
          }

          lrc.tags.push({
            tag: tag.tag,
            value: tag.value,
          });
        }
        continue;
      }

      const parsed = parseWords(line);

      for (const { time, timeInMs } of timestamps) {
        const entry: LRCLine = {
          time,
          timeInMs,
          text: parsed.text,
          words: [],
          duration: Infinity,
        };

        // Word times are absolute, so they only make sense for a single
        // timestamp. A repeated line (chorus) falls back to line-level timing.
        if (timestamps.length === 1 && parsed.words.length) {
          rawWords.set(entry, parsed.words);
        }

        lrc.lines.push(entry);
      }
    }

    // Apply the offset to lines and words together, before any duration is
    // computed, so that no duration is derived from a half-shifted timeline.
    if (offset) {
      for (const line of lrc.lines) {
        line.timeInMs += offset;
        for (const word of rawWords.get(line) ?? []) {
          word.timeInMs += offset;
          if (word.endInMs !== undefined) word.endInMs += offset;
        }
      }
    }

    lrc.lines.sort(({ timeInMs: timeA }, { timeInMs: timeB }) => timeA - timeB);
    for (let i = 0; i < lrc.lines.length; i++) {
      const current = lrc.lines[i];
      const next = lrc.lines[i + 1];

      if (next) {
        current.duration = next.timeInMs - current.timeInMs;
      }

      const words = rawWords.get(current);
      if (!words) continue;

      const lineEnd = next ? next.timeInMs : undefined;
      current.words = words.map((word, idx) => {
        const end =
          word.endInMs ??
          words[idx + 1]?.timeInMs ??
          lineEnd ??
          word.timeInMs + FALLBACK_WORD_DURATION;

        return {
          timeInMs: word.timeInMs,
          duration: Math.max(0, end - word.timeInMs),
          word: word.word,
          space: word.space,
        };
      });
    }

    const first = lrc.lines.at(0);
    if (first && first.timeInMs > 300) {
      lrc.lines.unshift({
        time: '00:00:00',
        timeInMs: 0,
        duration: first.timeInMs,
        text: '',
        words: [],
      });
    }

    return lrc;
  },
};

/**
 * Helpers for the word-level (karaoke) animation of a synced line.
 *
 * A word lasts until the next one starts (the parser already turns the two
 * timestamps into `duration`). The sweep that lights up its letters only uses
 * `WORD_SWEEP_RATIO` of that time, so the word is fully lit a little before the
 * next one starts and the highlight never looks like it is lagging behind.
 */
export const WORD_SWEEP_RATIO = 0.9;

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Splits a word into the letters (grapheme clusters) the sweep lights up. */
export const splitLetters = (text: string): string[] =>
  Array.from(segmenter.segment(text), ({ segment }) => segment);

/** How long the sweep takes, in ms, for a word that lasts `duration` ms. */
export const sweepDuration = (duration: number): number =>
  Math.round(Math.max(0, duration) * WORD_SWEEP_RATIO);

/**
 * How often `currentTime` is refreshed from the player, in ms. The sweep is
 * given this long to glide from one value to the next (see `style.css`).
 */
export const CLOCK_TICK_MS = 100;

/**
 * How far the sweep of a word is, from 0 (nothing lit) to 1 (every letter lit),
 * `elapsed` ms after the word started, for a word that lasts `duration` ms.
 */
export const wordProgress = (elapsed: number, duration: number): number => {
  if (elapsed < 0) return 0;

  const total = sweepDuration(duration);
  return total <= 0 ? 1 : Math.min(1, elapsed / total);
};

/**
 * The glow/wobble of the "fancy" line effect, for a word that lasts
 * `duration` ms. Their durations come from `:root`, where `var()` is already
 * resolved, so a per-word duration has to be set on the animation itself.
 */
export const glowAnimation = (duration: number, fancy: boolean): string =>
  fancy
    ? `lyrics-glow ${duration}ms forwards, lyrics-wobble ${duration / 2}ms forwards`
    : 'none';

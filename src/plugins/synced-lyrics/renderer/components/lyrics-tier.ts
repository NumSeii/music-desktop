import type { LyricResult } from '../../types';

/**
 * How good the lyrics of a provider are, from best to worst:
 *
 *  3. word-synced (karaoke)
 *  2. line-synced
 *  1. plain
 *  0. nothing
 */
export const lyricsTier = (data: LyricResult | null | undefined): number => {
  if (data?.lines?.some((line) => line.words?.length)) return 3;
  if (data?.lines?.length) return 2;
  if (data?.lyrics) return 1;
  return 0;
};

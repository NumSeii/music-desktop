import { Lyricsfile } from '../parsers/lyricsfile';

import type { LineLyrics } from '../types';

/** A record of the LRCLib `/api/search` response. */
export interface LRCLibRecord {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  /** In seconds. */
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string;
  /** Word-level timing is only available in `lyricsfile` (YAML). */
  hasWordSync?: boolean;
  lyricsfile?: string | null;
}

/**
 * Any record further than this (in seconds) from the song being played is a
 * different cut, so its timing cannot be trusted.
 */
export const MAX_DURATION_DIFF = 15;

/**
 * A word-synced record has to be much closer than that, otherwise its word
 * timing drifts. This is LRCLib's own tolerance for `/api/get`.
 */
export const WORD_SYNC_MAX_DURATION_DIFF = 2;

export interface PickedRecord {
  record: LRCLibRecord;
  /** The lines of the lyricsfile, only when `record` is word-synced. */
  wordLines: LineLyrics[] | null;
}

/**
 * Picks which of the records to use, in this order:
 *
 *  1. word-synced lyrics (karaoke), if the lyricsfile can be read
 *  2. line-synced lyrics
 *  3. plain lyrics
 *
 * `records` must already be sorted by how close their duration is to
 * `songDuration`, closest first. Within a tier the closest record wins.
 */
export const pickRecord = (
  records: LRCLibRecord[],
  songDuration: number,
): PickedRecord | null => {
  const closest = records[0];
  if (!closest) return null;
  if (Math.abs(closest.duration - songDuration) > MAX_DURATION_DIFF) {
    return null;
  }

  if (closest.instrumental) return null;

  const wordSynced = records.find(
    (item) =>
      item.hasWordSync &&
      item.lyricsfile &&
      !item.instrumental &&
      Math.abs(item.duration - songDuration) <= WORD_SYNC_MAX_DURATION_DIFF,
  );
  const wordLines = wordSynced
    ? Lyricsfile.parse(wordSynced.lyricsfile!)
    : null;
  if (wordSynced && wordLines) return { record: wordSynced, wordLines };

  const lineSynced = records.find(
    (item) =>
      item.syncedLyrics &&
      !item.instrumental &&
      Math.abs(item.duration - songDuration) <= MAX_DURATION_DIFF,
  );
  if (lineSynced) return { record: lineSynced, wordLines: null };

  if (closest.plainLyrics) return { record: closest, wordLines: null };

  return null;
};

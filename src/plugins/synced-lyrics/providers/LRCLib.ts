import { jaroWinkler } from '@skyra/jaro-winkler';

import { pickRecord, type LRCLibRecord } from './lrclib-selection';

import { LRC } from '../parsers/lrc';
import { config } from '../renderer/renderer';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class LRCLib implements LyricProvider {
  name = 'LRCLib';
  baseUrl = 'https://lrclib.net';

  async search({
    title,
    alternativeTitle,
    artist,
    album,
    songDuration,
    tags,
  }: SearchSongInfo): Promise<LyricResult | null> {
    let query = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });

    query.set('album_name', album!);
    if (query.get('album_name') === 'undefined') {
      query.delete('album_name');
    }

    let url = `${this.baseUrl}/api/search?${query.toString()}`;
    let response = await fetch(url);

    if (!response.ok) {
      throw new Error(`bad HTTPStatus(${response.statusText})`);
    }

    let data = (await response.json()) as LRCLIBSearchResponse;
    if (!data || !Array.isArray(data)) {
      throw new Error(`Expected an array, instead got ${typeof data}`);
    }

    if (data.length === 0) {
      if (!config()?.showLyricsEvenIfInexact) {
        return null;
      }

      // Try to search with the alternative title (original language)
      const trackName = alternativeTitle || title;
      query = new URLSearchParams({ q: `${trackName}` });
      url = `${this.baseUrl}/api/search?${query.toString()}`;

      response = await fetch(url);
      if (!response.ok) {
        throw new Error(`bad HTTPStatus(${response.statusText})`);
      }

      data = (await response.json()) as LRCLIBSearchResponse;
      if (!Array.isArray(data)) {
        throw new Error(`Expected an array, instead got ${typeof data}`);
      }

      // If still no results, try with the original title as fallback
      if (data.length === 0 && alternativeTitle) {
        query = new URLSearchParams({ q: title });
        url = `${this.baseUrl}/api/search?${query.toString()}`;

        response = await fetch(url);
        if (!response.ok) {
          throw new Error(`bad HTTPStatus(${response.statusText})`);
        }

        data = (await response.json()) as LRCLIBSearchResponse;
        if (!Array.isArray(data)) {
          throw new Error(`Expected an array, instead got ${typeof data}`);
        }
      }
    }

    // Versions with word-level timing are rare, and the field search above often
    // ranks them out of its first 20 results. Without one, ask the free-text
    // search too. It is an optional extra, so it never fails the whole search.
    if (!data.some((item) => item.hasWordSync)) {
      const known = new Set(data.map(({ id }) => id));
      const extra = await this.searchWordSynced(title, artist);
      data = [...data, ...extra.filter(({ id }) => !known.has(id))];
    }

    const filteredResults = [];
    for (const item of data) {
      const { artistName } = item;

      const artists = artist.split(/[&,]/g).map((i) => i.trim());
      const itemArtists = artistName.split(/[&,]/g).map((i) => i.trim());

      // Try to match using artist name first
      const permutations = [];
      for (const artistA of artists) {
        for (const artistB of itemArtists) {
          permutations.push([artistA.toLowerCase(), artistB.toLowerCase()]);
        }
      }

      for (const artistA of itemArtists) {
        for (const artistB of artists) {
          permutations.push([artistA.toLowerCase(), artistB.toLowerCase()]);
        }
      }

      let ratio = Math.max(...permutations.map(([x, y]) => jaroWinkler(x, y)));

      // If direct artist match is below threshold and we have tags, try matching with tags
      if (ratio <= 0.9 && tags && tags.length > 0) {
        // Filter out the artist from tags to avoid duplicate comparisons
        const filteredTags = tags.filter(
          (tag) => tag.toLowerCase() !== artist.toLowerCase(),
        );

        const tagPermutations = [];
        // Compare each tag with each item artist
        for (const tag of filteredTags) {
          for (const itemArtist of itemArtists) {
            tagPermutations.push([tag.toLowerCase(), itemArtist.toLowerCase()]);
          }
        }

        // Compare each item artist with each tag
        for (const itemArtist of itemArtists) {
          for (const tag of filteredTags) {
            tagPermutations.push([itemArtist.toLowerCase(), tag.toLowerCase()]);
          }
        }

        if (tagPermutations.length > 0) {
          const tagRatio = Math.max(
            ...tagPermutations.map(([x, y]) => jaroWinkler(x, y)),
          );

          // Use the best match ratio between direct artist match and tag match
          ratio = Math.max(ratio, tagRatio);
        }
      }

      if (ratio <= 0.9) continue;
      filteredResults.push(item);
    }

    filteredResults.sort(({ duration: durationA }, { duration: durationB }) => {
      const left = Math.abs(durationA - songDuration);
      const right = Math.abs(durationB - songDuration);

      return left - right;
    });

    // Word-synced lyrics first, then line-synced, then plain.
    const picked = pickRecord(filteredResults, songDuration);
    if (!picked) {
      return null;
    }

    const { record, wordLines } = picked;
    const raw = record.syncedLyrics;

    return {
      title: record.trackName,
      artists: record.artistName.split(/[&,]/g),
      lines:
        wordLines ??
        (raw
          ? LRC.parse(raw).lines.map((l) => ({
              ...l,
              status: 'upcoming' as const,
            }))
          : undefined),
      lyrics: record.plainLyrics,
    };
  }

  private async searchWordSynced(
    title: string,
    artist: string,
  ): Promise<LRCLIBSearchResponse> {
    try {
      const query = new URLSearchParams({ q: `${title} ${artist}` });
      const response = await fetch(`${this.baseUrl}/api/search?${query}`);
      if (!response.ok) return [];

      const data = (await response.json()) as LRCLIBSearchResponse;
      return Array.isArray(data) ? data.filter((item) => item.hasWordSync) : [];
    } catch {
      return [];
    }
  }
}

type LRCLIBSearchResponse = LRCLibRecord[];

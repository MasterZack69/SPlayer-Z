import type { Track } from "../types/player";

/**
 * Keep only four-digit positive calendar years supplied by metadata.
 * @param value - Parsed or server-provided year.
 */
export const validYear = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isInteger(value) && value > 0 && value <= 9999 ? value : undefined;

/**
 * Resolve a track's year, including album-only server metadata.
 * @param track - Lightweight track metadata.
 */
export const getTrackYear = (track: Track): number | undefined =>
  validYear(track.year) ?? validYear(track.album?.year);

/**
 * Collect distinct known years in chronological order without inventing an unknown year.
 * @param tracks - Tracks in the current library or album.
 */
export const trackYears = (tracks: Track[]): number[] =>
  [...new Set(tracks.map(getTrackYear).filter((year): year is number => year !== undefined))].sort(
    (a, b) => a - b,
  );

/**
 * Count tracks by observed calendar year; missing years are excluded, not zero-filled.
 * @param tracks - Library snapshot without CUE container duplicates.
 */
export const countTrackYears = (tracks: Track[]): { year: number; count: number }[] => {
  const counts = new Map<number, number>();
  for (const track of tracks) {
    const year = getTrackYear(track);
    if (year !== undefined) counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a - b).map(([year, count]) => ({ year, count }));
};

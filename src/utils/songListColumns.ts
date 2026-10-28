export const SONG_LIST_COLUMNS = [
  "index",
  "title",
  "album",
  "genre",
  "year",
  "actions",
  "duration",
  "size",
] as const;

export type SongListColumn = (typeof SONG_LIST_COLUMNS)[number];

export const SONG_LIST_COLUMN_LABELS: Record<SongListColumn, string> = {
  index: "settings.songListColumns.index",
  title: "songList.title",
  album: "songList.album",
  genre: "songList.genre",
  year: "year.singular",
  actions: "songList.actions",
  duration: "songList.duration",
  size: "songList.size",
};

export const SONG_LIST_COLUMN_WIDTHS: Record<SongListColumn, string> = {
  index: "2rem",
  title: "minmax(0, 1.5fr)",
  album: "minmax(0, 1fr)",
  genre: "minmax(0, 0.7fr)",
  year: "4rem",
  actions: "3rem",
  duration: "4rem",
  size: "4.5rem",
};

/** Keep known columns once and append newly introduced columns in default order.
 * @param saved - Persisted column order.
 * @returns A complete order containing only built-in columns.
 */
export const normalizeSongListColumnOrder = (saved: unknown): SongListColumn[] => {
  const known = Array.isArray(saved)
    ? SONG_LIST_COLUMNS.filter((column) => saved.includes(column))
    : [];
  const ordered = Array.isArray(saved)
    ? [...new Set(saved.filter((column): column is SongListColumn => known.includes(column)))]
    : [];
  return [...ordered, ...SONG_LIST_COLUMNS.filter((column) => !ordered.includes(column))];
};

/** Remove unknown hidden columns and keep the title available.
 * @param saved - Persisted visibility exclusions.
 * @returns Valid optional columns to hide.
 */
export const normalizeSongListHiddenColumns = (saved: unknown): SongListColumn[] =>
  SONG_LIST_COLUMNS.filter(
    (column) => column !== "title" && Array.isArray(saved) && saved.includes(column),
  );

/**
 * Match user text against searchable metadata without changing the source values.
 * @param query - User-entered search text.
 * @param values - Metadata fields to search.
 * @returns Whether any field contains the normalized query.
 */
export const matchesSearch = (query: string, ...values: (string | undefined)[]): boolean => {
  const normalized = query.trim().normalize("NFKC").toLocaleLowerCase();
  return (
    !normalized ||
    values.some((value) => value?.normalize("NFKC").toLocaleLowerCase().includes(normalized))
  );
};

export const PAGE_SEARCH_SCOPES: Record<string, string> = {
  library: "library",
  liked: "liked",
  collection: "collection",
  artist: "artist",
  "artist-list": "artists",
  "album-list": "albums",
  "genre-list": "genres",
  "unknown-genre": "songs",
  folders: "folders",
  "year-list": "yearSongs",
  year: "yearSongs",
  "streaming-songs": "songs",
  "streaming-albums": "albums",
  "streaming-artists": "artists",
  "streaming-playlists": "playlists",
};

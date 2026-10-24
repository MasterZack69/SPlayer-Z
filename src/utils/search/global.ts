import type { Album, Artist, Playlist, Track } from "@shared/types/player";
import type { PlaylistSummary } from "@shared/types/playlist";
import type { FolderNode } from "@/types/folder";
import type { CoverItem } from "@/types/artist";
import { normalizeGenre } from "@shared/utils/genre";
import { getTrackYear } from "@shared/utils/year";
import { matchesSearch } from "./match";

export const ENTITY_CATEGORIES = [
  "albums",
  "artists",
  "genres",
  "years",
  "playlists",
  "folders",
] as const;
export type EntityCategory = (typeof ENTITY_CATEGORIES)[number];
export type SearchCategory = "all" | "songs" | EntityCategory;

export interface SearchEntity extends CoverItem {
  category: EntityCategory;
  years?: number[];
  source: "local" | "streaming";
  resourceId: string;
  serverId?: string;
}

export interface SearchLibrary {
  tracks: Track[];
  folders: FolderNode[];
  playlists: PlaylistSummary[];
  server: {
    id?: string;
    songs: Track[];
    albums: Album[];
    artists: Artist[];
    playlists: Playlist[];
  };
}

export interface SearchIndex {
  songs: Track[];
  albums: SearchEntity[];
  artists: SearchEntity[];
  genres: SearchEntity[];
  years: SearchEntity[];
  playlists: SearchEntity[];
  folders: SearchEntity[];
}

/**
 * Build a disposable metadata index over local and synchronized server libraries.
 * Tracks are referenced, not cloned; no lyrics, network queries, or module caches are retained.
 * @param library - Current library snapshots and playlist summaries.
 * @returns Categorized metadata with source-safe resource identities.
 */
export const buildSearchIndex = (library: SearchLibrary): SearchIndex => {
  const maps = Object.fromEntries(
    ENTITY_CATEGORIES.map((category) => [category, new Map<string, SearchEntity>()]),
  ) as Record<EntityCategory, Map<string, SearchEntity>>;
  const songs = [
    ...new Map(
      [...library.tracks, ...library.server.songs].map((track) => [
        JSON.stringify([track.source, track.serverId, track.id]),
        track,
      ]),
    ).values(),
  ];

  /**
   * Merge a resource into its category without conflating local and server IDs.
   * @param entity - Resource metadata to merge.
   * @param countTrack - Whether this occurrence contributes a track to the summary.
   */
  const add = (entity: Omit<SearchEntity, "id">, countTrack = false): void => {
    const id = JSON.stringify([entity.category, entity.source, entity.serverId, entity.resourceId]);
    const existing = maps[entity.category].get(id);
    if (!existing) maps[entity.category].set(id, { ...entity, id });
    else if (countTrack) {
      existing.trackCount += 1;
      existing.years = [...new Set([...(existing.years ?? []), ...(entity.years ?? [])])].sort(
        (a, b) => a - b,
      );
    }
  };

  for (const track of songs) {
    if (track.source !== "local" && track.source !== "streaming") continue;
    const year = getTrackYear(track);
    if (year !== undefined)
      add(
        {
          category: "years",
          source: "local",
          resourceId: String(year),
          title: String(year),
          trackCount: 1,
        },
        true,
      );
    const source = track.source;
    const serverId = track.serverId ?? (source === "streaming" ? library.server.id : undefined);
    if (track.album?.name)
      add(
        {
          category: "albums",
          years: year === undefined ? [] : [year],
          source,
          serverId,
          resourceId: source === "local" ? track.album.name : (track.album.id ?? track.album.name),
          title: track.album.name,
          subtitle: track.album.artist ?? track.artists.map((a) => a.name).join(" / "),
          cover: track.album.cover ?? track.cover,
          trackCount: 1,
        },
        true,
      );
    for (const artist of track.artists)
      add(
        {
          category: "artists",
          source,
          serverId,
          resourceId: source === "local" ? artist.name : (artist.id ?? artist.name),
          title: artist.name,
          cover: artist.avatar ?? track.cover,
          trackCount: 1,
        },
        true,
      );
    for (const genre of new Set(track.genres?.map(normalizeGenre).filter(Boolean)))
      add(
        {
          category: "genres",
          source: "local",
          resourceId: genre.toLocaleLowerCase(),
          title: genre,
          cover: track.cover,
          trackCount: 1,
        },
        true,
      );
  }
  for (const album of library.server.albums) {
    const serverId = album.serverId ?? library.server.id;
    const resourceId = album.id ?? album.name;
    const id = JSON.stringify(["albums", "streaming", serverId, resourceId]);
    const existing = maps.albums.get(id);
    maps.albums.set(id, {
      category: "albums",
      id,
      resourceId,
      source: "streaming",
      serverId,
      title: album.name,
      subtitle: album.artist,
      years: existing?.years?.length ? existing.years : album.year ? [album.year] : [],
      cover: album.cover ?? existing?.cover,
      trackCount: album.trackCount ?? existing?.trackCount ?? 0,
    });
  }
  for (const artist of library.server.artists)
    add({
      category: "artists",
      source: "streaming",
      serverId: artist.serverId ?? library.server.id,
      resourceId: artist.id ?? artist.name,
      title: artist.name,
      cover: artist.avatar,
      trackCount: 0,
    });
  for (const playlist of library.playlists)
    add({
      category: "playlists",
      source: "local",
      resourceId: playlist.id,
      title: playlist.title,
      subtitle: playlist.description,
      cover: playlist.cover,
      trackCount: playlist.trackCount,
    });
  for (const playlist of library.server.playlists)
    add({
      category: "playlists",
      source: "streaming",
      serverId: playlist.serverId ?? library.server.id,
      resourceId: playlist.id ?? playlist.name,
      title: playlist.name,
      subtitle: playlist.description,
      cover: playlist.cover,
      trackCount: playlist.trackCount ?? 0,
    });

  /**
   * Add searchable folder metadata, including nested and CUE-backed folders.
   * @param folders - Nodes from the existing library folder tree.
   */
  const addFolders = (folders: FolderNode[]): void => {
    for (const folder of folders) {
      add({
        category: "folders",
        source: "local",
        resourceId: folder.path,
        title: folder.name,
        subtitle: folder.path,
        cover: folder.tracks[0]?.cover,
        trackCount: folder.tracks.length,
      });
      addFolders(folder.children);
    }
  };
  addFolders(library.folders);
  return {
    songs,
    ...Object.fromEntries(
      ENTITY_CATEGORIES.map((category) => [category, [...maps[category].values()]]),
    ),
  } as SearchIndex;
};

/**
 * Search every category using the same metadata matching rules.
 * @param index - Current library index.
 * @param query - User-entered query.
 * @param genre - Optional exact genre selected from a genre result.
 * @returns Matching resources, or empty categories for an empty query.
 */
export const searchIndex = (index: SearchIndex, query: string, genre?: string): SearchIndex => {
  const active = Boolean(query.trim());
  return {
    songs: active
      ? index.songs.filter((track) =>
          genre
            ? track.genres?.some(
                (value) =>
                  normalizeGenre(value).toLowerCase() === normalizeGenre(genre).toLowerCase(),
              )
            : matchesSearch(
                query,
                track.title,
                track.album?.name,
                getTrackYear(track)?.toString(),
                ...track.artists.map((a) => a.name),
                ...(track.genres ?? []),
              ) ||
              track.genres?.some((value) =>
                matchesSearch(normalizeGenre(query), normalizeGenre(value)),
              ),
        )
      : [],
    ...Object.fromEntries(
      ENTITY_CATEGORIES.map((category) => [
        category,
        active
          ? index[category].filter((entity) =>
              matchesSearch(
                category === "genres" ? normalizeGenre(query) : query,
                entity.title,
                entity.subtitle,
                ...(entity.years ?? []).map(String),
              ),
            )
          : [],
      ]),
    ),
  } as SearchIndex;
};

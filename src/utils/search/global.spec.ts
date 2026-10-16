import { describe, expect, it } from "vitest";
import type { Track } from "@shared/types/player";
import { buildFolderTree } from "@/utils/folderTree";
import { buildSearchIndex, searchIndex, type SearchLibrary } from "./global";
import { matchesSearch } from "./match";

const track: Track = {
  id: "same-id",
  source: "local",
  title: "Midnight Song",
  duration: 180000,
  artists: [{ name: "Test Artist" }],
  album: { name: "Night Album" },
  genres: ["Pop", "Dance"],
  path: "/music/Night/track.flac",
};
/**
 * Create independent library snapshots for search regressions.
 * @param overrides - Snapshot fields to replace.
 * @returns A searchable local and self-hosted library.
 */
const fixture = (overrides: Partial<SearchLibrary> = {}): SearchLibrary => ({
  tracks: [track],
  folders: buildFolderTree([track], ["/music"]),
  playlists: [
    {
      id: "same-id",
      type: "local",
      title: "Night Mix",
      description: "Driving",
      trackCount: 1,
      createTime: 0,
      updateTime: 0,
    },
  ],
  server: {
    id: "server-a",
    songs: [{ ...track, source: "streaming", serverId: "server-a", path: undefined }],
    albums: [{ id: "empty-album", name: "Empty Album", trackCount: 0 }],
    artists: [{ id: "empty-artist", name: "Empty Artist" }],
    playlists: [{ id: "same-id", name: "Night Mix" }],
  },
  ...overrides,
});

describe("global search index", () => {
  it("searches song metadata, albums, artists, genres, playlists, and nested folders", () => {
    const index = buildSearchIndex(fixture());
    expect(searchIndex(index, "  NIGHT ").songs).toHaveLength(2);
    expect(searchIndex(index, "night").albums).toHaveLength(2);
    expect(searchIndex(index, "artist").artists).toHaveLength(3);
    expect(searchIndex(index, "pop").genres.map((item) => item.title)).toEqual(["Pop"]);
    expect(searchIndex(index, "pop").songs).toHaveLength(2);
    expect(searchIndex(index, "driving").playlists).toHaveLength(1);
    expect(searchIndex(index, "night").folders[0].resourceId).toBe("/music/Night");
  });
  it("includes synchronized entities with no loaded songs and retains server identity", () => {
    const results = searchIndex(buildSearchIndex(fixture()), "empty");
    expect(results.songs).toHaveLength(0);
    expect(results.albums[0]).toMatchObject({ resourceId: "empty-album", serverId: "server-a" });
    expect(results.artists[0]).toMatchObject({ resourceId: "empty-artist", serverId: "server-a" });
  });
  it("does not merge equal local/server IDs or categories sharing a name", () => {
    const library = fixture();
    library.tracks[0] = {
      ...track,
      title: "same",
      album: { name: "same" },
      artists: [{ name: "same" }],
      genres: ["same"],
    };
    const index = buildSearchIndex(library);
    expect(index.songs).toHaveLength(2);
    const results = searchIndex(index, "same");
    const ids = [...results.albums, ...results.artists, ...results.genres, ...index.playlists].map(
      (item) => item.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(index.playlists.map((item) => item.source)).toEqual(["local", "streaming"]);
  });
  it("deduplicates tracks, preserves references, and counts repeated albums correctly", () => {
    const library = fixture({ tracks: [track, track, { ...track, id: "second" }] });
    const index = buildSearchIndex(library);
    expect(index.songs).toHaveLength(3);
    expect(index.songs[0]).toBe(track);
    expect(index.albums.find((album) => album.source === "local")?.trackCount).toBe(2);
    expect(index.genres.find((genre) => genre.title === "Pop")?.trackCount).toBe(3);
  });
  it("clears every category for blank queries", () => {
    const index = buildSearchIndex(fixture());
    expect(Object.values(searchIndex(index, "  ")).every((items) => items.length === 0)).toBe(true);
  });
  it("selects an exact genre instead of similarly named genres", () => {
    const library = fixture({ tracks: [track, { ...track, id: "rock", genres: ["Pop Rock"] }] });
    const result = searchIndex(buildSearchIndex(library), "Pop", "pop");
    expect(result.songs.map((song) => song.id)).not.toContain("rock");
  });
  it("finds CUE folders using the audio path rather than the synthetic track path", () => {
    const cue = { ...track, path: "cue://album/1", cueAudioPath: "/music/Disc/image.flac" };
    const index = buildSearchIndex(
      fixture({ tracks: [cue], folders: buildFolderTree([cue], ["/music"]) }),
    );
    expect(searchIndex(index, "disc").folders[0].resourceId).toBe("/music/Disc");
  });
  it("normalizes Unicode metadata and treats whitespace as no scoped filter", () => {
    expect(matchesSearch("ｎｉｇｈｔ", "Night Album")).toBe(true);
    expect(matchesSearch(" ", undefined)).toBe(true);
    expect(matchesSearch("absent", "Night Album")).toBe(false);
  });
});

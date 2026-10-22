import { describe, expect, it } from "vitest";
import type { Track } from "@shared/types/player";
import { getTrackYear, trackYears, countTrackYears, validYear } from "@shared/utils/year";
import { buildSearchIndex, searchIndex } from "./global";
const song = (id: string, year?: number): Track => ({
  id,
  source: "local",
  title: id,
  artists: [],
  album: { name: "Mixed" },
  duration: 1000,
  year,
});
describe("calendar year metadata", () => {
  it("deduplicates and sorts album years and excludes unknown values", () => {
    const tracks = [song("a", 2024), song("b", 1999), song("c", 2024), song("d")];
    expect(trackYears(tracks).join(" / ")).toBe("1999 / 2024");
    expect(countTrackYears(tracks)).toEqual([
      { year: 1999, count: 1 },
      { year: 2024, count: 2 },
    ]);
    for (const value of [0, -1, 10000, 2024.5, NaN, Infinity])
      expect(validYear(value)).toBeUndefined();
    expect(getTrackYear({ ...song("e"), album: { name: "Server", year: 2001 } })).toBe(2001);
  });
  it("searches songs, mixed-year albums and text year categories", () => {
    const index = buildSearchIndex({
      tracks: [song("a", 1999), song("b", 2024)],
      folders: [],
      playlists: [],
      server: {
        songs: [],
        albums: [{ id: "server-album", name: "Remote", year: 2005 }],
        artists: [],
        playlists: [],
      },
    });
    expect(searchIndex(index, "2024").songs.map((song) => song.id)).toEqual(["b"]);
    expect(searchIndex(index, "1999").albums[0].title).toBe("Mixed");
    expect(searchIndex(index, "2024").albums[0].title).toBe("Mixed");
    expect(searchIndex(index, "2005").albums[0].title).toBe("Remote");
    expect(index.years.map((year) => year.title)).toEqual(["1999", "2024"]);
    expect(searchIndex(index, " ").years).toEqual([]);
  });
});

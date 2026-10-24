// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: null as DatabaseSync | null }));
vi.mock("./index", () => ({ getDb: () => state.db! }));
import { GENRE_ALIASES } from "@shared/utils/genre";
import { getGenreList, getGenreTracks, getLibraryStats } from "./queries";

beforeEach(() => {
  state.db = new DatabaseSync(":memory:");
  state.db.exec(`CREATE TABLE tracks (
    id TEXT PRIMARY KEY, path TEXT, cue_audio_path TEXT, title TEXT,
    artists TEXT DEFAULT '[]', album TEXT, genres TEXT, duration INTEGER DEFAULT 1000,
    cover TEXT, codec TEXT, file_size INTEGER DEFAULT 10
  )`);
  const insert = state.db.prepare(
    "INSERT INTO tracks (id, path, genres, cover, cue_audio_path) VALUES (?, ?, ?, ?, ?)",
  );
  insert.run("a", "/a.flac", JSON.stringify(["Rap/Hip Hop", "Hip-Hop/Rap"]), "cover-a", null);
  insert.run("b", "/b.flac", JSON.stringify([" hip hop/rap "]), null, null);
  insert.run("c", "/c.flac", JSON.stringify(["RAP/HIP-HOP"]), null, null);
  insert.run("rock", "/rock.flac", JSON.stringify(["Pop/Rock"]), null, null);
  insert.run("rap", "/rap.flac", JSON.stringify(["Rap"]), null, null);
  insert.run("unknown", "/unknown.flac", JSON.stringify([]), null, null);
  insert.run("container", "/container.flac", JSON.stringify(["Hip-Hop/Rap"]), null, null);
  insert.run("cue", "cue://album/1", JSON.stringify(["HipHop/Rap"]), null, "/container.flac");
});
afterEach(() => state.db?.close());

describe("genre alias queries", () => {
  it("merges existing tags without double counting or exposing CUE containers", () => {
    const genres = getGenreList();
    expect(genres).toHaveLength(3);
    expect(genres[0]).toEqual({ name: "Hip-Hop/Rap", trackCount: 4, cover: "cover-a" });
    expect(getLibraryStats().genreCount).toBe(3);
  });
  it.each([
    ...Object.keys(GENRE_ALIASES).filter((alias) => GENRE_ALIASES[alias] === "Hip-Hop/Rap"),
    " RAP/HIP-HOP ",
  ])("opens the complete collection from %s while retaining source tags", (name) => {
    const tracks = getGenreTracks(name);
    expect(tracks.map((track) => track.id).sort()).toEqual(["a", "b", "c", "cue"]);
    expect(tracks.find((track) => track.id === "a")?.genres).toEqual([
      "Rap/Hip Hop",
      "Hip-Hop/Rap",
    ]);
    expect(state.db!.prepare("SELECT genres FROM tracks WHERE id = 'b'").get()?.genres).toBe(
      '[" hip hop/rap "]',
    );
  });
  it("groups Alternativo with Alternative without merging Alternative Rock", () => {
    const insert = state.db!.prepare("INSERT INTO tracks (id, path, genres) VALUES (?, ?, ?)");
    insert.run("alt-a", "/alt-a.flac", '["Alternative"]');
    insert.run("alt-b", "/alt-b.flac", '["Alternativo", "Alternative"]');
    insert.run("alt-rock", "/alt-rock.flac", '["Alternative Rock"]');
    expect(getGenreList().find((genre) => genre.name === "Alternative")?.trackCount).toBe(2);
    for (const name of ["Alternative", "Alternativo", " ALTERNATIVO "]) {
      const tracks = getGenreTracks(name);
      expect(tracks.map((track) => track.id).sort()).toEqual(["alt-a", "alt-b"]);
      expect(tracks.find((track) => track.id === "alt-b")?.genres).toEqual([
        "Alternativo",
        "Alternative",
      ]);
    }
    expect(getGenreTracks("Alternative Rock").map((track) => track.id)).toEqual(["alt-rock"]);
  });
  it("keeps unrelated genres and empty metadata separate", () => {
    expect(getGenreTracks("Rap").map((track) => track.id)).toEqual(["rap"]);
    expect(getGenreTracks("Pop/Rock").map((track) => track.id)).toEqual(["rock"]);
    expect(getGenreTracks("")).toEqual([]);
  });
});

// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: null as DatabaseSync | null }));
vi.mock("./index", () => ({
  getDb: () => ({
    prepare: (sql: string) => state.db!.prepare(sql),
    transaction: (work: () => void) => () => {
      state.db!.exec("BEGIN");
      try {
        work();
        state.db!.exec("COMMIT");
      } catch (error) {
        state.db!.exec("ROLLBACK");
        throw error;
      }
    },
  }),
}));
import { migrate } from "./migration";
import {
  getAllTracks,
  getAlbumList,
  getFileRecords,
  getPendingYearPaths,
  upsertTracks,
  type UpsertTrack,
} from "./queries";
/** Adapt SQLite's test API to the pragma surface used by production migrations. */
const adapter = () =>
  ({
    prepare: (sql: string) => state.db!.prepare(sql),
    exec: (sql: string) => state.db!.exec(sql),
    pragma: (sql: string) =>
      sql.includes("=")
        ? state.db!.exec(`PRAGMA ${sql}`)
        : Object.values(state.db!.prepare(`PRAGMA ${sql}`).get()!)[0],
  }) as unknown as Database.Database;
/** Build a scanner record with deterministic file identity. */
const track = (id: string, year?: number): UpsertTrack => ({
  id,
  path: `/${id}.flac`,
  title: id,
  artists: [],
  album: { name: "Mixed" },
  duration: 1000,
  fileSize: 10,
  mtime: 100,
  ctime: 100,
  year,
});
beforeEach(() => {
  state.db = new DatabaseSync(":memory:");
  state.db.exec(
    `CREATE TABLE tracks (id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL, cue_path TEXT, cue_audio_path TEXT, cue_start_ms INTEGER, cue_end_ms INTEGER, title TEXT, track INTEGER, artists TEXT, album TEXT, genres TEXT, duration INTEGER, cover TEXT, codec TEXT, sample_rate INTEGER, bit_rate INTEGER, channels INTEGER, bits_per_sample INTEGER, file_size INTEGER, file_mtime INTEGER, file_ctime INTEGER, scanned_at INTEGER); CREATE TABLE lyric_match_cache (extra TEXT); PRAGMA user_version = 6;`,
  );
});
afterEach(() => state.db?.close());
describe("one-time year backfill", () => {
  it("marks old rows pending but marks scanned unknown years complete", () => {
    state.db!.exec(
      "INSERT INTO tracks (id,path,title,artists,genres,file_size,file_mtime) VALUES ('old','/old.flac','Old','[]','[]',10,100)",
    );
    migrate(adapter());
    expect(getFileRecords()).toEqual([
      { path: "/old.flac", mtime: 100, size: 10, forceScan: true },
    ]);
    upsertTracks([track("old")]);
    expect(getFileRecords()[0].forceScan).toBe(false);
    expect(getAllTracks()[0].year).toBeUndefined();
    migrate(adapter());
    expect(getFileRecords()[0].forceScan).toBe(false);
  });
  it("round-trips years and aggregates album years excluding hidden CUE containers", () => {
    migrate(adapter());
    upsertTracks([
      track("a", 1999),
      track("b", 2024),
      track("c", 2024),
      track("d"),
      track("container", 1980),
      { ...track("cue", 2024), cuePath: "/album.cue", cueAudioPath: "/container.flac" },
    ]);
    expect(getAllTracks().find((track) => track.id === "a")?.year).toBe(1999);
    expect(getAlbumList()[0].years).toEqual([1999, 2024]);
    state.db!.exec("UPDATE tracks SET year_scanned = 0 WHERE id = 'cue'");
    expect([...getPendingYearPaths()]).toEqual(["/cue.flac"]);
  });
});

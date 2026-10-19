import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  readdir: vi.fn(),
  rm: vi.fn(),
}));
vi.mock("electron", () => ({
  dialog: {},
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => unknown) =>
      mocks.handlers.set(name, handler),
  },
}));
vi.mock("node:fs/promises", () => ({ default: { readdir: mocks.readdir, rm: mocks.rm } }));
vi.mock("node:fs", () => ({ default: { existsSync: () => true }, existsSync: () => true }));
vi.mock("@main/store", () => ({ store: {} }));
vi.mock("@main/utils/config", () => ({
  getAppCacheDir: () => "/cache",
  getCoverCacheDir: () => "/cache/covers",
  getArtistCacheDir: () => "/cache/artists",
  getBackgroundsDir: () => "/cache/backgrounds",
}));
vi.mock("@main/services/engine", () => ({ syncCoverCacheDir: vi.fn() }));
vi.mock("@main/utils/logger", () => ({ systemLog: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@main/utils/paths", () => ({ defaultCacheDir: "/cache" }));
import { registerCacheIpc } from "./cache";

describe("artwork-only cache management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.readdir.mockResolvedValue([]);
    registerCacheIpc();
  });

  it("exposes only cover, artist, and background cache statistics", async () => {
    await expect(mocks.handlers.get("cache:getStats")!()).resolves.toEqual([
      { id: "covers", kind: "file", path: "/cache/covers", size: 0 },
      { id: "artists", kind: "file", path: "/cache/artists", size: 0 },
      { id: "backgrounds", kind: "file", path: "/cache/backgrounds", size: 0 },
    ]);
  });

  it.each(["lyric", "lyricTTML", "lyricMatch"])("ignores removed %s cache requests", async (id) => {
    await mocks.handlers.get("cache:clear")!(null, id);
    expect(mocks.readdir).not.toHaveBeenCalled();
    expect(mocks.rm).not.toHaveBeenCalled();
  });

  it("clears artwork files without touching the library database", async () => {
    mocks.readdir.mockResolvedValue(["cover.png"]);
    await mocks.handlers.get("cache:clearAllByKind")!(null, "file");
    expect(mocks.rm.mock.calls.map(([path]) => path).sort()).toEqual([
      "/cache/artists/cover.png",
      "/cache/backgrounds/cover.png",
      "/cache/covers/cover.png",
    ]);
  });
});

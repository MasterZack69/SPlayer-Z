import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
import { ErrorCode } from "@shared/types/errors";
const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  lookup: vi.fn(),
  fetch: vi.fn(),
  download: vi.fn(),
  online: vi.fn(),
  settings: { system: { cache: { songCache: { enabled: false, cacheStreaming: true } } } },
}));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => mocks.settings }));
vi.mock("@/utils/errors", () => ({ handleError: mocks.error }));
import { resolveTrackSource } from "./audioSource";
const local: Track = {
  id: "local",
  source: "local",
  title: "本地歌曲",
  artists: [],
  duration: 1000,
  path: "/music/local.flac",
};
const server: Track = {
  ...local,
  id: "server:remote",
  source: "streaming",
  serverId: "server",
  originalId: "remote",
  serverRevision: 3,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.settings.system.cache.songCache.enabled = false;
  Object.assign(window, {
    api: {
      cache: { song: { lookup: mocks.lookup, fetch: mocks.fetch } },
      download: { lookup: mocks.download },
      apis: { netease: mocks.online },
    },
  });
});
describe("离线与自托管音源", () => {
  it("本地文件无需任何网络或下载查询", async () => {
    expect(await resolveTrackSource(local)).toEqual({
      source: local.path,
      provider: "local",
      fromCache: false,
    });
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.online).not.toHaveBeenCalled();
  });
  it("CUE 分轨使用实际音频路径", async () => {
    expect((await resolveTrackSource({ ...local, cueAudioPath: "/music/disc.flac" }))?.source).toBe(
      "/music/disc.flac",
    );
  });
  it("缺失本地路径时返回明确错误", async () => {
    const error = vi.fn();
    expect(
      await resolveTrackSource({ ...local, path: undefined }, { silent: true, onError: error }),
    ).toBeNull();
    expect(error).toHaveBeenCalledWith(ErrorCode.FILE_NOT_FOUND);
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it.each(["netease", "qqmusic", "kugou"] as const)(
    "拒绝旧队列的 %s 曲目，即使有旧下载或缓存",
    async (source) => {
      mocks.settings.system.cache.songCache.enabled = true;
      mocks.download.mockResolvedValue("/downloads/old.flac");
      mocks.lookup.mockResolvedValue("/cache/old.flac");
      expect(await resolveTrackSource({ ...local, source }, { silent: true })).toBeNull();
      expect(mocks.download).not.toHaveBeenCalled();
      expect(mocks.lookup).not.toHaveBeenCalled();
      expect(mocks.online).not.toHaveBeenCalled();
    },
  );
  it("自托管曲目仅向主进程传递身份，不泄露凭据", async () => {
    expect(await resolveTrackSource(server)).toEqual({
      source: "streaming://server/remote?revision=3",
      provider: "streaming",
      fromCache: false,
    });
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("ignores old cache settings and always resolves the server stream", async () => {
    mocks.settings.system.cache.songCache.enabled = true;
    mocks.lookup.mockResolvedValue("/cache/old.flac");
    const result = await resolveTrackSource(server);
    expect(result?.provider).toBe("streaming");
    expect(result).not.toHaveProperty("cacheRequest");
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

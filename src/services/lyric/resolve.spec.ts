import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  online: vi.fn(),
  repo: vi.fn(),
  settings: {
    lyric: { lyricFormatOrder: ["ttml", "lrc"] },
    system: { localLyric: { enableLocalTTMLOverride: false, repoDir: "/lyrics" } },
  },
}));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => mocks.settings }));
vi.mock("./request", () => ({ requestStreamingLyric: mocks.server }));
import {
  resolveOnlineByPreference,
  resolveTTMLOverlay,
  resolvePluginLyric,
  resolveStreamingByPreference,
  resolveLyricForPreload,
  resolveLocalRepoLyric,
} from "./resolve";
const track: Track = {
  id: "server:1",
  source: "streaming",
  serverId: "server",
  originalId: "1",
  title: "歌曲",
  artists: [],
  duration: 1000,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.settings.system.localLyric.enableLocalTTMLOverride = false;
  Object.assign(window, {
    api: {
      lyrics: {
        matchById: mocks.online,
        matchByQuery: mocks.online,
        fetchTTMLOverlay: mocks.online,
        matchLocalTTML: mocks.repo,
      },
      plugins: { matchLyric: mocks.online },
    },
  });
});
describe("不再获取在线歌词", () => {
  it.each(["netease", "qqmusic", "kugou", "local", "streaming"] as const)(
    "旧 %s 来源偏好不能发起网络匹配",
    async (source) => {
      expect(
        await resolveOnlineByPreference(
          { ...track, source },
          { hasLocal: false, localFormat: null },
        ),
      ).toBeNull();
      expect(await resolvePluginLyric(track)).toBeNull();
      expect(
        await resolveTTMLOverlay(track, {
          source: { source: "online", format: "lrc", platform: "netease" },
          input: { content: "旧歌词" },
        }),
      ).toBeNull();
      expect(mocks.online).not.toHaveBeenCalled();
    },
  );
  it("只读取当前媒体服务器的歌词", async () => {
    mocks.server.mockResolvedValue("[00:01.00]服务器歌词");
    expect((await resolveStreamingByPreference(track))?.input.content).toContain("服务器歌词");
    expect(mocks.server).toHaveBeenCalledWith(track);
    expect(mocks.online).not.toHaveBeenCalled();
  });
  it("切歌后丢弃旧服务器响应", async () => {
    mocks.server.mockResolvedValue("[00:01.00]旧歌词");
    expect(await resolveStreamingByPreference(track, () => false)).toBeNull();
  });
  it("本地歌词库无需在线服务", async () => {
    mocks.settings.system.localLyric.enableLocalTTMLOverride = true;
    mocks.repo.mockResolvedValue({ ok: true, data: "<tt>本地歌词</tt>" });
    expect((await resolveLocalRepoLyric(track))?.source).toEqual({
      source: "external",
      format: "ttml",
    });
    expect(mocks.online).not.toHaveBeenCalled();
  });
  it("不预载本地或已移除平台的歌词", async () => {
    expect(await resolveLyricForPreload({ ...track, source: "local" }, () => true)).toBeNull();
    expect(await resolveLyricForPreload({ ...track, source: "kugou" }, () => true)).toBeNull();
    expect(mocks.server).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track, TrackDetail } from "@shared/types/player";
const mocks = vi.hoisted(() => ({
  media: {
    track: null as Track | null,
    detail: null as TrackDetail | null,
    setLyric: vi.fn(),
    resetLyricState: vi.fn(),
  },
  settings: {
    lyric: { lyricFormatOrder: ["ttml", "lrc"] },
    system: { localLyric: { enableLocalTTMLOverride: false, repoDir: "/lyrics" } },
  },
  repo: vi.fn(),
  server: vi.fn(),
  read: vi.fn(),
  preloaded: vi.fn(),
  online: vi.fn(),
}));
vi.mock("@/stores/media", () => ({ useMediaStore: () => mocks.media }));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => mocks.settings }));
vi.mock("./preload", () => ({ consumePreloadedLyric: mocks.preloaded }));
vi.mock("./request", () => ({ requestStreamingLyric: mocks.server }));
import { loadForTrack } from "./loader";
const local: Track = {
  id: "1",
  source: "local",
  title: "歌曲",
  artists: [],
  duration: 1000,
  path: "/music/song.flac",
};
const detail = {
  externalLyrics: [],
  embeddedLyric: "[00:01.00]内嵌歌词",
} as unknown as TrackDetail;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.media.track = local;
  mocks.settings.system.localLyric.enableLocalTTMLOverride = false;
  mocks.preloaded.mockResolvedValue({ hit: false });
  Object.assign(window, {
    api: {
      player: { readLyricFile: mocks.read },
      lyrics: {
        matchLocalTTML: mocks.repo,
        matchById: mocks.online,
        matchByQuery: mocks.online,
        fetchTTMLOverlay: mocks.online,
      },
      plugins: { matchLyric: mocks.online },
    },
  });
});
describe("本地及自托管歌词加载", () => {
  it("内嵌歌词无需在线请求", async () => {
    await loadForTrack(detail);
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(
      { source: "embedded", format: "lrc" },
      { content: detail.embeddedLyric },
    );
    expect(mocks.online).not.toHaveBeenCalled();
  });
  it("本地旁挂文件优先于内嵌标签", async () => {
    mocks.read.mockResolvedValue({ success: true, data: "[00:01.00]旁挂歌词" });
    await loadForTrack({ ...detail, externalLyrics: [{ path: "/music/song.lrc", format: "lrc" }] });
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(
      { source: "external", format: "lrc" },
      { content: "[00:01.00]旁挂歌词" },
    );
    expect(mocks.online).not.toHaveBeenCalled();
  });
  it("旁挂文件不存在时回退内嵌标签", async () => {
    mocks.read.mockResolvedValue({ success: false });
    await loadForTrack({ ...detail, externalLyrics: [{ path: "/missing.lrc", format: "lrc" }] });
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(
      { source: "embedded", format: "lrc" },
      { content: detail.embeddedLyric },
    );
  });
  it("没有歌词时明确清空，不发起网络搜索", async () => {
    await loadForTrack(null);
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(null, null);
    expect(mocks.online).not.toHaveBeenCalled();
    expect(mocks.server).not.toHaveBeenCalled();
  });
  it("媒体服务器歌词正常加载", async () => {
    mocks.media.track = { ...local, source: "streaming", serverId: "server", originalId: "1" };
    mocks.server.mockResolvedValue("[00:01.00]服务器歌词");
    await loadForTrack(null);
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(
      { source: "external", format: "lrc" },
      { content: "[00:01.00]服务器歌词" },
    );
    expect(mocks.online).not.toHaveBeenCalled();
  });
  it("loads TTML sidecar files without consulting a library", async () => {
    mocks.settings.system.localLyric.enableLocalTTMLOverride = true;
    const ttml =
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1s" end="2s">Local lyrics</p></div></body></tt>';
    mocks.read.mockResolvedValue({ success: true, data: ttml });
    await loadForTrack({
      ...detail,
      externalLyrics: [{ path: "/music/song.ttml", format: "ttml" }],
    });
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(
      { source: "external", format: "ttml" },
      { content: ttml },
    );
    expect(mocks.repo).not.toHaveBeenCalled();
    expect(mocks.server).not.toHaveBeenCalled();
  });
  it("preserves embedded TTML support", async () => {
    const ttml =
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1s" end="2s">Embedded</p></div></body></tt>';
    await loadForTrack({ ...detail, embeddedLyric: ttml });
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(
      { source: "embedded", format: "ttml" },
      { content: ttml },
    );
  });
  it("快速切歌后迟到的歌词不能污染新曲", async () => {
    let finish!: (result: unknown) => void;
    mocks.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const old = loadForTrack({ ...detail, externalLyrics: [{ path: "/old.lrc", format: "lrc" }] });
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalled());
    mocks.media.track = { ...local, id: "2" };
    await loadForTrack(detail);
    finish({ success: true, data: "[00:01.00]旧歌词" });
    await old;
    expect(mocks.media.setLyric).toHaveBeenLastCalledWith(
      { source: "embedded", format: "lrc" },
      { content: detail.embeddedLyric },
    );
  });
  it.each(["netease", "qqmusic", "kugou"] as const)(
    "旧 %s 曲目不会获取在线歌词",
    async (source) => {
      mocks.media.track = { ...local, source };
      await loadForTrack(detail);
      expect(mocks.media.setLyric).toHaveBeenLastCalledWith(null, null);
      expect(mocks.online).not.toHaveBeenCalled();
      expect(mocks.server).not.toHaveBeenCalled();
    },
  );
});

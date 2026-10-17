import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import type { Track } from "@shared/types/player";

const mocks = vi.hoisted(() => ({
  settings: {
    player: {
      preloadNextTrack: true,
      songLevel: "hq",
      allowTrialPlay: false,
      transitionMode: "crossfade",
      transitionPreference: "standard",
    },
    system: {
      lyric: { enableOnlineTTMLLyric: false },
      localLyric: { enableLocalTTMLOverride: false, repoDir: "" },
    },
    lyric: {
      lyricSourcePreference: "auto",
      lyricSourceOrder: [],
      lyricFormatOrder: [],
      smartPreferOnline: false,
      preferPluginLyric: false,
    },
    preset: { skipKeywordsSongs: false, skipTrackKeywords: [] },
  },
  status: {
    currentTrack: { id: "current" },
    state: "playing",
    trackLoading: false,
    playIndex: 0,
    fmMode: false,
    shuffleMode: "off",
  },
  candidate: { track: { id: "next", source: "local" } },
  resolve: vi.fn(),
  prepare: vi.fn(),
  cancel: vi.fn(),
  lyric: vi.fn(),
}));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => mocks.settings }));
vi.mock("@/stores/status", () => ({ useStatusStore: () => mocks.status }));
vi.mock("@/stores/media", () => ({ useMediaStore: () => ({ track: { id: "current" } }) }));
vi.mock("@/stores/streaming", () => ({ useStreamingStore: () => ({ activeServerId: "server" }) }));
vi.mock("@/stores/plugins", () => ({ usePluginsStore: () => ({ list: [] }) }));
vi.mock("@/stores/queue", () => ({ queue: { value: [] } }));
vi.mock("@/core/player/candidate", () => ({ getNextTrackCandidate: () => mocks.candidate }));
vi.mock("@/services/audioSource", () => ({ resolveTrackSource: mocks.resolve }));
vi.mock("@/services/lyric/preload", () => ({
  preloadLyricForTrack: mocks.lyric,
  invalidatePreloadedLyric: vi.fn(),
}));

describe("下一曲真实预载", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.resolve.mockReset();
    mocks.status = reactive({ ...mocks.status, state: "playing", trackLoading: false });
    mocks.settings = reactive(mocks.settings);
    mocks.settings.player.preloadNextTrack = true;
    mocks.settings.player.transitionMode = "crossfade";
    mocks.settings.player.transitionPreference = "standard";
    mocks.candidate.track = { id: "next", source: "local" };
    mocks.prepare.mockResolvedValue(true);
    mocks.cancel.mockResolvedValue(undefined);
    Object.assign(window, {
      api: { player: { prepareNext: mocks.prepare, cancelPrepared: mocks.cancel } },
    });
  });

  afterEach(async () => {
    const preloader = await import("./nextTrackPreloader");
    preloader.disposeNextTrackPreload();
  });

  it("已下载歌曲直接准备原生预载槽位", async () => {
    mocks.resolve.mockResolvedValueOnce({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.any(String),
      "/music/next.flac",
      undefined,
      "standard",
    );
    expect(preloader.consumePreloadedTrack(mocks.candidate.track as Track)?.preparedId).toEqual(
      expect.any(String),
    );
  });

  it("解析返回空值后允许同一候选重新预载", async () => {
    mocks.resolve.mockResolvedValueOnce(null).mockResolvedValueOnce({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.resolve).toHaveBeenCalledTimes(2);
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(
      preloader.consumePreloadedTrack(mocks.candidate.track as Track)?.preparedId,
    ).toBeTruthy();
  });

  it("当前歌曲加载完成前不启动下一曲预载", async () => {
    mocks.status.state = "loading";
    mocks.resolve.mockResolvedValue({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");
    preloader.installNextTrackPreloadWatchers();
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.resolve).not.toHaveBeenCalled();
    mocks.status.state = "playing";
    await flushPromises();
    expect(mocks.prepare).toHaveBeenCalledOnce();
  });

  it("停止后迟到的解析结果不能恢复预载", async () => {
    let finish!: (source: unknown) => void;
    mocks.resolve.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const preloader = await import("./nextTrackPreloader");
    preloader.installNextTrackPreloadWatchers();
    preloader.scheduleNextTrackPreload();
    mocks.status.state = "stopped";
    await flushPromises();
    finish({ source: "/music/next.flac", provider: "local", fromCache: false });
    await flushPromises();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(preloader.consumePreloadedTrack(mocks.candidate.track as Track)).toBeNull();
  });

  it("暂停保留在途预载，暂停后的结果仍可消费", async () => {
    let finish!: (source: unknown) => void;
    mocks.resolve.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const preloader = await import("./nextTrackPreloader");
    preloader.installNextTrackPreloadWatchers();
    preloader.scheduleNextTrackPreload();
    mocks.status.state = "paused";
    await flushPromises();
    expect(mocks.resolve).toHaveBeenCalledOnce();
    expect(mocks.cancel).not.toHaveBeenCalled();
    finish({ source: "/music/next.flac", provider: "local", fromCache: false });
    await flushPromises();
    expect(
      preloader.consumePreloadedTrack(mocks.candidate.track as Track)?.preparedId,
    ).toBeTruthy();
  });

  it("旧任务返回空值不会清理新任务的预载结果", async () => {
    let finish!: (source: null) => void;
    mocks.resolve.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    preloader.invalidateNextTrackPreload();
    mocks.resolve.mockResolvedValueOnce({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    const id = mocks.prepare.mock.calls[0]![0];
    finish(null);
    await flushPromises();
    expect(mocks.cancel).not.toHaveBeenCalledWith(id);
    expect(preloader.consumePreloadedTrack(mocks.candidate.track as Track)?.preparedId).toBe(id);
  });

  it("替换播放列表后等待当前曲加载完成，再准备下一首槽位", async () => {
    mocks.candidate.track.source = "local";
    mocks.resolve.mockResolvedValue({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");

    mocks.status.trackLoading = true;
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();

    mocks.status.trackLoading = false;
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(preloader.peekPreparedTrack(mocks.candidate.track as Track)?.preparedId).toBeDefined();
  });

  it("preloads local songs without a disk song cache", async () => {
    mocks.candidate.track.source = "local";
    mocks.resolve.mockResolvedValue({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.any(String),
      "/music/next.flac",
      undefined,
      "standard",
    );
    expect(preloader.peekPreparedTrack(mocks.candidate.track as Track)?.preparedId).toBeDefined();
  });

  it("local CUE preloading retains its start offset", async () => {
    Object.assign(mocks.candidate.track, {
      source: "local",
      cueAudioPath: "/music/album.flac",
      cueStartMs: 120000,
      cueEndMs: 240000,
    });
    mocks.resolve.mockResolvedValue({
      source: "/music/album.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.any(String),
      "/music/album.flac",
      120000,
      "standard",
    );
    expect(preloader.peekPreparedTrack(mocks.candidate.track as Track)?.preparedId).toBeDefined();
  });

  it("未准备完就切歌时取消准备任务，不能消费未就绪资源", async () => {
    let finish!: (ready: boolean) => void;
    mocks.resolve.mockResolvedValue({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    mocks.prepare.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(preloader.consumePreloadedTrack(mocks.candidate.track as Track)).toBeNull();
    expect(mocks.cancel).toHaveBeenCalledWith(mocks.prepare.mock.calls[0]![0]);
    finish(true);
    await flushPromises();
    expect(preloader.consumePreloadedTrack(mocks.candidate.track as Track)).toBeNull();
  });

  it.each(["关闭过渡", "修改倾向", "关闭预载"])("%s 时保留已提交交接的所有权", async (change) => {
    mocks.resolve.mockResolvedValue({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");
    preloader.installNextTrackPreloadWatchers();
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    const prepared = preloader.beginPreparedTransition(mocks.candidate.track as Track)!;
    expect(prepared.preparedId).toBeTruthy();
    if (change === "关闭过渡") mocks.settings.player.transitionMode = "none";
    if (change === "修改倾向") mocks.settings.player.transitionPreference = "eager";
    if (change === "关闭预载") mocks.settings.player.preloadNextTrack = false;
    await flushPromises();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(preloader.consumePreloadedTrack(mocks.candidate.track as Track)).toBeNull();
    expect(mocks.cancel).not.toHaveBeenCalled();
    preloader.finishPreparedTransition(prepared.preparedId!);
    await flushPromises();
    expect(mocks.cancel).toHaveBeenCalledWith(prepared.preparedId);
    expect(mocks.prepare).toHaveBeenCalledTimes(change === "关闭预载" ? 1 : 2);
  });

  it("迟到槽位通知不能取走当前备用槽位", async () => {
    mocks.resolve.mockResolvedValue({
      source: "/music/next.flac",
      provider: "local",
      fromCache: false,
    });
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(
      preloader.beginPreparedTransition(mocks.candidate.track as Track, "old-slot"),
    ).toBeNull();
    expect(preloader.peekPreparedTrack(mocks.candidate.track as Track)?.preparedId).toBeTruthy();
  });
  it("never preloads or downloads a streaming track to disk", async () => {
    mocks.candidate.track.source = "streaming";
    const preloader = await import("./nextTrackPreloader");
    preloader.scheduleNextTrackPreload();
    await flushPromises();
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(preloader.consumePreloadedTrack(mocks.candidate.track as Track)).toBeNull();
  });
});

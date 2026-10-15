import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  load: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  seek: vi.fn(),
  stop: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/apis/netease", () => ({ netease: {}, neteaseCall: mocks.request }));
vi.mock("@/apis/song/qqmusic", () => ({ resolveQQMusicUrl: vi.fn() }));
vi.mock("@/apis/song/kugou", () => ({ resolveKugouUrl: vi.fn() }));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({ isLoggedIn: true, fetchStatus: async () => true }),
}));
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({
    preset: { skipKeywordsSongs: false, skipTrackKeywords: [] },
    player: { songLevel: "hq", allowTrialPlay: false },
    system: { cache: { songCache: { enabled: false } }, player: { rememberLastTrack: true } },
    lyric: { cjkTransform: "none" },
  }),
}));
vi.mock("@/stores/plugins", () => ({ usePluginsStore: () => ({ list: [] }) }));
vi.mock("@/stores/streaming", () => ({ useStreamingStore: vi.fn() }));
vi.mock("@/stores/history", () => ({ useHistoryStore: () => ({ record: vi.fn() }) }));
vi.mock("@/stores/library", () => ({ useLibraryStore: vi.fn() }));
vi.mock("localforage", () => ({
  default: { createInstance: () => ({ setItem: async () => null }) },
}));
vi.mock("./fm", () => ({}));
vi.mock("./stats", () => ({ installPlayStats: vi.fn(), onTrackEnded: vi.fn() }));
vi.mock("@/services/nextTrackPreloader", () => ({
  consumePreloadedTrack: () => null,
  invalidateNextTrackPreload: vi.fn(),
  scheduleNextTrackPreload: vi.fn(),
}));
vi.mock("@/services/lyric/loader", () => ({
  beginLoad: vi.fn(),
  loadForTrack: vi.fn(),
  watchLyricPreference: vi.fn(),
}));
vi.mock("@/services/coverLoader", () => ({ loadCoverForTrack: vi.fn() }));
vi.mock("@/services/abLoop", () => ({ reset: vi.fn() }));
vi.mock("@/services/cacheScheduler", () => ({ cancel: vi.fn(), schedule: vi.fn() }));
vi.mock("@/services/deviceVolume", () => ({ getDeviceVolume: vi.fn(), setDeviceVolume: vi.fn() }));
vi.mock("@/composables/useFavorite", () => ({ useFavorite: vi.fn() }));
vi.mock("@/composables/useToast", () => ({ toast: { error: mocks.toast } }));
vi.mock("@/composables/useDialog", () => ({ dialog: { alert: async () => undefined } }));
vi.mock("@/utils/color", () => ({ extractColorFromUrl: vi.fn() }));
vi.mock("@/i18n", () => ({
  default: { global: { t: (key: string) => key, te: () => true } },
}));

const tracks: Track[] = ["current", "next", "last"].map((id) => ({
  id,
  title: id,
  source: "streaming",
  serverId: "server",
  originalId: id,
  artists: [{ name: "测试歌手" }],
  duration: 180000,
}));
const oldUrl = "https://music.example/current?token=expired";
const newUrl = "streaming://server/current";
const resumePosition = 42000;

let player: typeof import("./index");
let events: typeof import("./events");
let playback: typeof import("@/services/playback");
let status: ReturnType<typeof import("@/stores/status").useStatusStore>;
let media: ReturnType<typeof import("@/stores/media").useMediaStore>;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  const { createPinia, setActivePinia } = await import("pinia");
  setActivePinia(createPinia());
  Object.assign(window, {
    api: {
      player: {
        load: mocks.load,
        play: mocks.play,
        pause: mocks.pause,
        seek: mocks.seek,
        stop: mocks.stop,
      },
      download: { lookup: async () => null },
      nowPlaying: { update: vi.fn() },
    },
  });
  mocks.load.mockResolvedValue({
    success: true,
    data: { detail: {}, mediaInfo: { duration: 180000 } },
  });
  mocks.play.mockResolvedValue({ success: true });
  mocks.pause.mockResolvedValue({ success: true });
  mocks.seek.mockResolvedValue({ success: true });
  mocks.stop.mockResolvedValue({ success: true });
  mocks.request.mockResolvedValue({ data: [{ url: newUrl, freeTrialInfo: null }] });
  const queue = await import("@/stores/queue");
  queue.setQueue(tracks);
  status = (await import("@/stores/status")).useStatusStore();
  media = (await import("@/stores/media")).useMediaStore();
  media.setTrack(tracks[0]!);
  status.playIndex = 0;
  status.state = "paused";
  status.position = resumePosition;
  status.duration = 180000;
  status.currentSource = oldUrl;
  playback = await import("@/services/playback");
  playback.setDuration(180000);
  playback.setCurrentTime(resumePosition, { force: true });
  playback.setPlaying(false);
  player = await import("./index");
  events = await import("./events");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("自托管歌曲的音源恢复", () => {
  it("服务器重新鉴权由主进程完成，渲染端只重传身份并恢复暂停位置", async () => {
    await events.handleEvent({ type: "sourceError" });
    expect(mocks.load).toHaveBeenCalledWith(
      "streaming://server/current",
      expect.objectContaining({ autoPlay: false }),
    );
    expect(mocks.seek).toHaveBeenCalledWith(resumePosition);
    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(status.state).toBe("paused");
  });
  it("播放时恢复服务器音源并继续播放", async () => {
    await player.play();
    await events.handleEvent({ type: "sourceError" });
    expect(mocks.load).toHaveBeenCalledWith(
      "streaming://server/current",
      expect.objectContaining({ autoPlay: false }),
    );
    expect(mocks.seek).toHaveBeenCalledWith(resumePosition);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(status.state).toBe("playing");
  });
  it("恢复期间停止后迟到的加载响应不能重启播放", async () => {
    let finish!: (result: unknown) => void;
    mocks.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const recovery = events.handleEvent({ type: "sourceError" });
    await vi.advanceTimersByTimeAsync(0);
    await player.stop();
    mocks.play.mockClear();
    finish({ success: true, data: { detail: {}, mediaInfo: { duration: 180000 } } });
    await recovery;
    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.seek).not.toHaveBeenCalled();
    expect(status.state).toBe("stopped");
  });
});

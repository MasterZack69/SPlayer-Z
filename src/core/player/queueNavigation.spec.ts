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
vi.mock("@/services/deviceVolume", () => ({ getDeviceVolume: vi.fn(), setDeviceVolume: vi.fn() }));
vi.mock("@/composables/useFavorite", () => ({ useFavorite: vi.fn() }));
vi.mock("@/composables/useToast", () => ({ toast: { error: mocks.toast, info: mocks.toast } }));
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
  artists: [{ name: "Test artist" }],
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

describe("single-entry queue navigation", () => {
  it.each([
    ["playing", "off"],
    ["paused", "off"],
    ["playing", "on"],
    ["paused", "on"],
  ] as const)("leaves %s playback intact on Next with shuffle %s", async (state, shuffle) => {
    const queue = await import("@/stores/queue");
    queue.setQueue([tracks[0]]);
    status.state = state;
    status.shuffleMode = shuffle;
    status.position = resumePosition;
    const entries = queue.queueEntries.value;
    const current = media.track;
    await player.nextTrack();
    expect(status.playIndex).toBe(0);
    expect(status.position).toBe(resumePosition);
    expect(status.state).toBe(state);
    expect(status.currentSource).toBe(oldUrl);
    expect(media.track).toBe(current);
    expect(queue.queueEntries.value).toBe(entries);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("player.noOtherTracks", {
      duration: 2000,
      icon: false,
    });
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
    expect(mocks.seek).not.toHaveBeenCalled();
    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.pause).not.toHaveBeenCalled();
  });

  it.each([
    ["playing", "off"],
    ["paused", "off"],
    ["playing", "on"],
    ["paused", "on"],
  ] as const)("restarts the sole %s track on Previous with shuffle %s", async (state, shuffle) => {
    const queue = await import("@/stores/queue");
    queue.setQueue([tracks[0]]);
    status.state = state;
    status.shuffleMode = shuffle;
    const entries = queue.queueEntries.value;
    const current = media.track;
    await player.prevTrack();
    expect(mocks.seek).toHaveBeenCalledExactlyOnceWith(0, true);
    expect(status.position).toBe(0);
    expect(playback.getCurrentTime()).toBe(0);
    expect(status.state).toBe(state);
    expect(status.playIndex).toBe(0);
    expect(status.currentSource).toBe(oldUrl);
    expect(media.track).toBe(current);
    expect(queue.queueEntries.value).toBe(entries);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.pause).not.toHaveBeenCalled();
  });

  it.each(["next", "prev"] as const)(
    "honors single-entry behavior for system media %s",
    async (type) => {
      const queue = await import("@/stores/queue");
      queue.setQueue([tracks[0]]);
      status.state = "playing";
      await events.handleEvent({ type });
      expect(status.position).toBe(type === "prev" ? 0 : resumePosition);
      expect(status.state).toBe("playing");
      expect(mocks.load).not.toHaveBeenCalled();
      if (type === "prev") {
        expect(mocks.seek).toHaveBeenCalledExactlyOnceWith(0, true);
        expect(mocks.toast).not.toHaveBeenCalled();
      } else {
        expect(mocks.seek).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each(["list", "one"] as const)("still repeats automatically in %s mode", async (mode) => {
    const queue = await import("@/stores/queue");
    queue.setQueue([tracks[0]]);
    status.repeatMode = mode;
    status.state = "playing";
    await events.handleEvent({ type: "ended" });
    expect(status.playIndex).toBe(0);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(status.state).toBe("playing");
  });

  it.each(["next", "prev"] as const)("keeps multi-entry %s navigation", async (direction) => {
    await (direction === "next" ? player.nextTrack() : player.prevTrack());
    expect(status.playIndex).toBe(direction === "next" ? 1 : 2);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("does nothing for an empty queue without displaying a single-song notice", async () => {
    const queue = await import("@/stores/queue");
    queue.setQueue([]);
    status.playIndex = -1;
    await player.nextTrack();
    await player.prevTrack();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.seek).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

describe("explicit featured-first playback", () => {
  it.each(["off", "on"] as const)(
    "keeps the requested first track at queue index zero with shuffle %s",
    async (shuffle) => {
      const queue = await import("@/stores/queue");
      const featuredFirst = [tracks[2], tracks[0], tracks[1]];
      status.shuffleMode = shuffle;
      await player.playFrom(featuredFirst, { startIndex: 0 });
      expect(queue.queue.value[0].id).toBe(tracks[2].id);
      expect(status.playIndex).toBe(0);
      expect(media.track?.id).toBe(tracks[2].id);
      expect(mocks.load).toHaveBeenCalledOnce();
      expect(queue.queue.value).toHaveLength(3);
    },
  );
});

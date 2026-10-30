import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/composables/useToast", () => ({ toast: { error: mocks.toast } }));
vi.mock("@/composables/useDialog", () => ({ dialog: { alert: async () => undefined } }));
vi.mock("@/utils/color", () => ({ extractColorFromUrl: vi.fn() }));
vi.mock("@/i18n", () => ({
  default: { global: { t: (key: string) => key, te: () => true } },
}));

let player: typeof import("./index");
let queue: typeof import("@/stores/queue");
let status: ReturnType<typeof import("@/stores/status").useStatusStore>;
const tracks: Track[] = ["a", "b", "c", "d"].map((id) => ({
  id,
  title: id,
  source: "local",
  duration: 180000,
  artists: [],
}));
beforeEach(async () => {
  const { createPinia, setActivePinia } = await import("pinia");
  setActivePinia(createPinia());
  queue = await import("@/stores/queue");
  queue.setQueue(tracks);
  status = (await import("@/stores/status")).useStatusStore();
  status.playIndex = 1;
  status.state = "playing";
  status.position = 42000;
  player = await import("./index");
  vi.clearAllMocks();
});

describe("queue reordering during playback", () => {
  it.each([
    [1, 3, 3],
    [0, 3, 0],
    [3, 0, 2],
    [2, 3, 1],
  ])("keeps the active entry when moving %i to %i", (from, to, current) => {
    player.moveInQueue(from, to);
    expect(status.playIndex).toBe(current);
    expect(queue.queue.value[status.playIndex].id).toBe("b");
    expect(status.position).toBe(42000);
    expect(status.state).toBe("playing");
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
  });
  it.each([
    [-1, 0],
    [1, 99],
    [0.5, 1],
    [1, NaN],
    [1, 1],
  ])("ignores invalid or unchanged destinations %s to %s", (from, to) => {
    const entries = queue.queueEntries.value;
    player.moveInQueue(from, to);
    expect(queue.queueEntries.value).toBe(entries);
    expect(status.playIndex).toBe(1);
  });
  it("moves queue-entry identity rather than confusing duplicate track IDs", () => {
    queue.setQueue([tracks[0], tracks[1], tracks[1], tracks[2]]);
    const current = queue.queueEntries.value[1];
    player.moveInQueue(1, 3);
    expect(queue.queueEntries.value[status.playIndex]).toBe(current);
  });
});

describe("single-song queue actions", () => {
  it("keeps Play Next directly after the current entry", () => {
    const next = { ...tracks[0], id: "next" };
    player.insertToQueue(next);
    expect(queue.queue.value.map((track) => track.id)).toEqual(["a", "b", "next", "c", "d"]);
    expect(status.currentTrack?.id).toBe("b");
    expect(status.position).toBe(42000);
  });

  it.each([false, true])("appends to the end without changing playback, shuffle=%s", (shuffle) => {
    if (shuffle) {
      queue.shuffleQueue(status.playIndex);
      status.playIndex = 0;
    }
    const before = queue.queue.value.map((track) => track.id);
    const context = { originType: "page" as const, originId: "library" };
    const added = { ...tracks[0], id: "added" };
    player.insertToQueue(added, queue.queueLength.value, context);
    expect(queue.queue.value.map((track) => track.id)).toEqual([...before, "added"]);
    expect(queue.queueEntries.value.at(-1)?.context).toEqual(context);
    expect(status.currentTrack?.id).toBe("b");
    expect(status.position).toBe(42000);
    expect(status.state).toBe("playing");
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.play).not.toHaveBeenCalled();
    if (shuffle) expect(queue.originalQueue.value?.at(-1)?.track.id).toBe("added");
  });

  it.each([0, 1, 3])(
    "moves an existing song to the tail without duplicating or restarting it, index=%s",
    (index) => {
      player.insertToQueue(tracks[index], queue.queueLength.value);
      expect(queue.queue.value.at(-1)?.id).toBe(tracks[index].id);
      expect(queue.queue.value).toHaveLength(tracks.length);
      expect(status.currentTrack?.id).toBe("b");
      expect(status.position).toBe(42000);
      expect(mocks.load).not.toHaveBeenCalled();
      expect(mocks.play).not.toHaveBeenCalled();
    },
  );

  it("adds to an empty queue without starting playback", () => {
    queue.setQueue([]);
    status.playIndex = -1;
    status.state = "stopped";
    player.insertToQueue(tracks[0], queue.queueLength.value);
    expect(queue.queue.value).toEqual([tracks[0]]);
    expect(status.playIndex).toBe(-1);
    expect(status.state).toBe("stopped");
    expect(mocks.load).not.toHaveBeenCalled();
  });
});

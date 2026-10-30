import { createPinia, disposePinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanProgress } from "@shared/types/library";
import type { Track } from "@shared/types/player";

const cache = vi.hoisted(() => ({
  getItem: vi.fn(async () => null),
  setItem: vi.fn(async () => undefined),
}));
vi.mock("localforage", () => ({ default: { createInstance: () => cache } }));
import { useLibraryStore } from "./library";
import { useSettingsStore } from "./settings";

let listener: (progress: ScanProgress) => void;
const unsubscribe = vi.fn();
const api = {
  getTracks: vi.fn(),
  getScanDirs: vi.fn(),
  getArtists: vi.fn(),
  getArtistTracks: vi.fn(),
  getGenreTracks: vi.fn(),
  getGenres: vi.fn(),
  scan: vi.fn(),
  cancelScan: vi.fn(),
  addScanDir: vi.fn(),
  removeScanDir: vi.fn(),
  onScanProgress: vi.fn(),
};
let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
  vi.resetAllMocks();
  cache.getItem.mockResolvedValue(null);
  cache.setItem.mockResolvedValue(undefined);
  pinia = createPinia();
  setActivePinia(pinia);
  api.getTracks.mockResolvedValue({ success: true, data: [] });
  api.getScanDirs.mockResolvedValue({ success: true, data: [] });
  api.getArtists.mockResolvedValue({ success: true, data: [] });
  api.scan.mockResolvedValue({ success: true });
  api.cancelScan.mockResolvedValue({ success: true });
  api.removeScanDir.mockResolvedValue({ success: true });
  api.onScanProgress.mockImplementation((callback) => {
    listener = callback;
    return unsubscribe;
  });
  Object.assign(window, { api: { library: api } });
});
afterEach(() => disposePinia(pinia));

describe("application-owned library indexing", () => {
  it("uses indexed cover artwork for local artists without an online avatar API", async () => {
    const track: Track = {
      id: "local:artist-song",
      source: "local",
      title: "Local Song",
      artists: [{ name: "Local Artist" }],
      album: { name: "Local Album" },
      duration: 180000,
      cover: "cache://covers/local.jpg",
    };
    api.getArtistTracks.mockResolvedValue({ success: true, data: [track] });
    const store = useLibraryStore();
    expect(await store.getArtistProfile("Local Artist")).toMatchObject({
      avatar: track.cover,
      tracks: [track],
      albums: [{ title: "Local Album", cover: track.cover }],
    });
    api.getArtistTracks.mockResolvedValue({
      success: true,
      data: [{ ...track, cover: undefined }],
    });
    expect((await store.getArtistProfile("Local Artist"))?.avatar).toBeUndefined();
  });

  it("scans a setup folder without mounting Library and publishes the completed index", async () => {
    const store = useLibraryStore();
    api.addScanDir.mockResolvedValue({ success: true, data: "/music" });
    await store.addScanDir();
    expect(api.onScanProgress).toHaveBeenCalledOnce();
    expect(api.onScanProgress.mock.invocationCallOrder[0]).toBeLessThan(
      api.scan.mock.invocationCallOrder[0],
    );
    expect(api.scan).toHaveBeenCalledWith(true);
    expect(store.scanning).toBe(true);
    const tracks = [{ id: "local:one", title: "New music" }] as Track[];
    api.getTracks.mockResolvedValue({ success: true, data: tracks });
    listener({ phase: "done", total: 1, scanned: 1 });
    await flushPromises();
    expect(store.tracks).toEqual(tracks);
    expect(store.scanning).toBe(false);
    expect(cache.setItem).toHaveBeenCalledWith("tracks", tracks);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("shares concurrent initialization and scans configured folders only once", async () => {
    api.getScanDirs.mockResolvedValue({ success: true, data: ["/music"] });
    const store = useLibraryStore();
    await Promise.all([store.initialize(), store.initialize(), store.load()]);
    await store.initialize();
    store.subscribeScanProgress();
    expect(api.getScanDirs).toHaveBeenCalledOnce();
    expect(api.onScanProgress).toHaveBeenCalledOnce();
    expect(api.scan).toHaveBeenCalledExactlyOnceWith(false);
    store.$dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("uses an incremental startup pass for an existing index", async () => {
    api.getScanDirs.mockResolvedValue({ success: true, data: ["/music"] });
    api.getTracks.mockResolvedValue({ success: true, data: [{ id: "existing" }] });
    await useLibraryStore().initialize();
    expect(api.scan).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("queues one follow-up pass when another folder is added during indexing", async () => {
    const store = useLibraryStore();
    api.addScanDir
      .mockResolvedValueOnce({ success: true, data: "/music" })
      .mockResolvedValueOnce({ success: true, data: "/other" });
    await store.addScanDir();
    await store.addScanDir();
    expect(api.scan).toHaveBeenCalledOnce();
    listener({ phase: "done", total: 1, scanned: 1 });
    await flushPromises();
    expect(api.scan).toHaveBeenCalledTimes(2);
    expect(store.scanDirs).toEqual(["/music", "/other"]);
    expect(store.scanning).toBe(true);
  });

  it("retains a requested full scan when later incremental requests are coalesced", async () => {
    const store = useLibraryStore();
    await store.startScan();
    await store.startScan(false);
    await store.startScan(true);
    listener({ phase: "done", total: 1, scanned: 1 });
    await flushPromises();
    expect(api.scan).toHaveBeenLastCalledWith(false);
    expect(api.scan).toHaveBeenCalledTimes(2);
  });

  it("does not scan after a cancelled picker or an empty first run", async () => {
    const store = useLibraryStore();
    await store.initialize();
    api.addScanDir.mockResolvedValue({ success: false, error: "SCAN_DIR_NOT_SELECTED" });
    await store.addScanDir();
    expect(api.scan).not.toHaveBeenCalled();
    expect(store.scanning).toBe(false);
  });

  it.each([false, true])("clears scanning when a scan request fails (throw=%s)", async (throws) => {
    const store = useLibraryStore();
    if (throws) api.scan.mockRejectedValue(new Error("Scanner unavailable"));
    else api.scan.mockResolvedValue({ success: false });
    await store.startScan();
    expect(store.scanning).toBe(false);
    expect(store.scanProgress).toBeNull();
  });

  it("clears an errored scan and lets the next request proceed", async () => {
    const store = useLibraryStore();
    await store.startScan();
    listener({ phase: "error", total: 1, scanned: 0, error: "Unreadable folder" });
    await flushPromises();
    expect(store.scanning).toBe(false);
    expect(store.scanProgress?.phase).toBe("error");
    await store.startScan();
    expect(api.scan).toHaveBeenCalledTimes(2);
  });

  it("cancels queued scans as well as the active pass", async () => {
    const store = useLibraryStore();
    await store.startScan();
    await store.startScan(false);
    await store.cancelScan();
    listener({ phase: "done", total: 1, scanned: 1 });
    await flushPromises();
    expect(api.scan).toHaveBeenCalledOnce();
    expect(store.scanning).toBe(false);
  });
});

describe("genre alias collections", () => {
  it("uses the canonical title for old links without modifying track metadata", async () => {
    const track = {
      id: "a",
      title: "Song",
      source: "local",
      artists: [],
      duration: 1000,
      genres: ["Rap/Hip Hop"],
    } as Track;
    api.getGenreTracks.mockResolvedValue({ success: true, data: [track] });
    const collection = await useLibraryStore().getGenreCollection("Rap/Hip Hop");
    expect(api.getGenreTracks).toHaveBeenCalledWith("Hip-Hop/Rap", true);
    expect(collection?.title).toBe("Hip-Hop/Rap");
    expect(collection?.tracks[0].genres).toEqual(["Rap/Hip Hop"]);
  });
});

it("forwards an explicit Music opt-out to both genre list and collection queries", async () => {
  useSettingsStore().preset.ignoreMusicGenre = false;
  api.getGenres.mockResolvedValue({ success: true, data: [{ name: "Music", trackCount: 1 }] });
  api.getGenreTracks.mockResolvedValue({
    success: true,
    data: [{ id: "music", title: "Track", source: "local", genres: ["Music"] }],
  });
  const store = useLibraryStore();
  expect(await store.getGenreList()).toEqual([{ name: "Music", trackCount: 1 }]);
  expect((await store.getGenreCollection("Music"))?.title).toBe("Music");
  expect(api.getGenres).toHaveBeenCalledWith(false);
  expect(api.getGenreTracks).toHaveBeenCalledWith("Music", false);
});

it("never rolls back a rejected nested directory through the destructive remove handler", async () => {
  const store = useLibraryStore();
  await store.initialize();
  api.addScanDir.mockResolvedValue({ success: false, error: "SCAN_DIR_NESTED" });
  expect(await store.addScanDir()).toEqual({ success: false, error: "SCAN_DIR_NESTED" });
  expect(api.removeScanDir).not.toHaveBeenCalled();
  expect(api.scan).not.toHaveBeenCalled();
  expect(store.scanDirs).toEqual([]);
});

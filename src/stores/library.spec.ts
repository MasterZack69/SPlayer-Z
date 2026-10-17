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

let listener: (progress: ScanProgress) => void;
const unsubscribe = vi.fn();
const api = {
  getTracks: vi.fn(),
  getScanDirs: vi.fn(),
  getArtists: vi.fn(),
  prefetchArtistAvatars: vi.fn(),
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

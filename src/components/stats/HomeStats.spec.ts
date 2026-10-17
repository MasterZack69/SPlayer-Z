import { shallowMount, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/core/player", () => ({ playNow: vi.fn() }));
const index = await vi.hoisted(async () => {
  const { reactive } = await import("vue");
  return reactive({ tracks: [] as unknown[] });
});
vi.mock("@/stores/library", () => ({ useLibraryStore: () => index }));
vi.mock("@/utils/navigate", () => ({ navigateToAlbum: vi.fn(), navigateToArtist: vi.fn() }));
import HomeStats from "./HomeStats.vue";
import StatsOverview from "./StatsOverview.vue";
import StatsHeatmap from "./StatsHeatmap.vue";
import StatsTopList from "./StatsTopList.vue";
const library = {
  trackCount: 174,
  albumCount: 100,
  artistCount: 60,
  genreCount: 12,
  totalDurationMs: 1000,
  totalFileSize: 1000,
  codecs: [],
};
const stats = {
  getLibraryStats: vi.fn(),
  getPlayHistoryDaily: vi.fn(),
  getPlayHistoryHourly: vi.fn(),
  getTopTracks: vi.fn(),
  getTopAlbums: vi.fn(),
  getTopArtists: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(window, { api: { stats } });
  for (const fn of Object.values(stats)) fn.mockResolvedValue([]);
  stats.getLibraryStats.mockResolvedValue(library);
});
/** Mount the Home statistics section independently of the charts' rendering internals. */
const mountStats = () =>
  shallowMount(HomeStats, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: "en",
          messages: { en: { stats: { label: "Stats" }, common: { error: "Unable to load" } } },
        }),
      ],
    },
  });
describe("Home statistics", () => {
  it("refreshes the overview and charts when a background scan publishes tracks", async () => {
    const wrapper = mountStats();
    await flushPromises();
    stats.getLibraryStats.mockResolvedValue({ ...library, trackCount: 250 });
    index.tracks = [{ id: "scanned" }];
    await flushPromises();
    expect(stats.getLibraryStats).toHaveBeenCalledTimes(2);
    expect(stats.getTopArtists).toHaveBeenCalledTimes(2);
    expect(wrapper.getComponent(StatsOverview).props("stats")?.trackCount).toBe(250);
    wrapper.unmount();
  });
  it("loads every dataset previously displayed by the Stats page", async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(stats.getPlayHistoryDaily).toHaveBeenCalledWith(90);
    expect(stats.getTopTracks).toHaveBeenCalledWith(10);
    expect(stats.getTopAlbums).toHaveBeenCalledWith(10);
    expect(stats.getTopArtists).toHaveBeenCalledWith(10);
    expect(stats.getPlayHistoryHourly).toHaveBeenCalledOnce();
    expect(wrapper.getComponent(StatsOverview).props("stats")).toEqual(library);
    expect(wrapper.getComponent(StatsHeatmap).props("loading")).toBe(false);
    expect(wrapper.findComponent(StatsTopList).exists()).toBe(true);
    wrapper.unmount();
  });
  it("ends the loading state and reports failed requests", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stats.getLibraryStats.mockRejectedValue(new Error("IPC failed"));
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Unable to load");
    expect(wrapper.getComponent(StatsHeatmap).props("loading")).toBe(false);
    wrapper.unmount();
  });
});

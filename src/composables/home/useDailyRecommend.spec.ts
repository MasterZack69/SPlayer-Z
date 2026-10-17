import { effectScope } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";

const mocks = vi.hoisted(() => ({ playFrom: vi.fn(), insert: vi.fn(), randomTracks: vi.fn() }));
vi.mock("@/core/player", () => ({ playFrom: mocks.playFrom, insertManyToQueue: mocks.insert }));
vi.mock("@/composables/useToast", () => ({ toast: { warning: vi.fn(), success: vi.fn() } }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string, args?: { song?: string }) => args?.song ?? key }),
}));
import { useDailyRecommend } from "./useDailyRecommend";

const tracks: Track[] = Array.from({ length: 6 }, (_, index) => ({
  id: String(index),
  title: `Song ${index}`,
  source: "local",
  duration: 180000,
  artists: [],
  cover: `cover-${index}`,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  mocks.randomTracks.mockResolvedValue({ success: true, data: tracks });
  window.api = { library: { getRandomTracks: mocks.randomTracks } } as never;
});

describe("Home featured queue order", () => {
  it("starts the displayed track at queue index zero and keeps the preview in the same order", async () => {
    const home = useDailyRecommend();
    await home.load();
    expect(home.hero.value).toMatchObject({ title: "Song 3", cover: "cover-3" });
    expect(home.previewTracks.value.map((track) => track.id)).toEqual(["3", "4", "5", "0"]);
    await home.playAll();
    const [queued, options] = mocks.playFrom.mock.calls[0];
    expect(queued.map((track: Track) => track.id)).toEqual(["3", "4", "5", "0", "1", "2"]);
    expect(options).toEqual({ startIndex: 0 });
    expect(queued[0].title).toBe(home.hero.value?.title);
    expect(tracks.map((track) => track.id)).toEqual(["0", "1", "2", "3", "4", "5"]);
  });
  it("adds the same featured-first order without replacing the existing queue", async () => {
    const home = useDailyRecommend();
    await home.load();
    mocks.insert.mockReturnValue(6);
    home.addToQueue();
    expect(mocks.insert.mock.calls[0][0].map((track: Track) => track.id)).toEqual([
      "3",
      "4",
      "5",
      "0",
      "1",
      "2",
    ]);
    expect(mocks.playFrom).not.toHaveBeenCalled();
  });
  it.each([{ items: [] }, { items: [tracks[0]] }])(
    "handles empty and single-track libraries",
    async ({ items }) => {
      mocks.randomTracks.mockResolvedValueOnce({ success: true, data: items });
      const home = useDailyRecommend();
      await home.load();
      await home.playAll();
      expect(home.previewTracks.value).toEqual(items);
      if (items.length) expect(mocks.playFrom).toHaveBeenCalledWith(items, { startIndex: 0 });
      else expect(mocks.playFrom).not.toHaveBeenCalled();
    },
  );
});

describe("Home random selection refresh", () => {
  it("ignores an empty pre-scan response that arrives after the completed index", async () => {
    let resolveOld: (value: unknown) => void = () => {};
    const getRandomTracks = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const tracks = [{ id: "new", title: "Scanned music" }] as Track[];
    getRandomTracks.mockResolvedValueOnce({ success: true, data: tracks });
    Object.assign(window, { api: { library: { getRandomTracks } } });
    const scope = effectScope();
    const hero = scope.run(useDailyRecommend)!;
    const old = hero.load();
    await hero.load();
    resolveOld({ success: true, data: [] });
    await old;
    expect(hero.previewTracks.value).toEqual(tracks);
    expect(hero.loading.value).toBe(false);
    scope.stop();
  });

  it("clears a previous selection when all indexed music is removed", async () => {
    const getRandomTracks = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: [{ id: "one", title: "Music" }] })
      .mockResolvedValueOnce({ success: true, data: [] });
    Object.assign(window, { api: { library: { getRandomTracks } } });
    const scope = effectScope();
    const hero = scope.run(useDailyRecommend)!;
    await hero.load();
    expect(hero.hero.value).not.toBeNull();
    await hero.load();
    expect(hero.hero.value).toBeNull();
    expect(hero.previewTracks.value).toEqual([]);
    scope.stop();
  });
});

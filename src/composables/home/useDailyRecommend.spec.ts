import { effectScope } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
vi.mock("@/core/player", () => ({ playFrom: vi.fn(), insertManyToQueue: vi.fn() }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
import { useDailyRecommend } from "./useDailyRecommend";

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

import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/settings/custom/FileCacheManager.vue", () => ({ default: {} }));
vi.mock("~icons/lucide/hard-drive", () => ({ default: {} }));
import localCacheCategory from "./localCache";

describe("local cache settings", () => {
  it("offers file cache management without obsolete lyric database controls", () => {
    expect(localCacheCategory.sections!.map((section) => section.id)).toEqual(["cache"]);
    expect(
      localCacheCategory.sections!.flatMap((section) => section.items.map((item) => item.key)),
    ).toEqual(["fileCacheManager"]);
  });
});

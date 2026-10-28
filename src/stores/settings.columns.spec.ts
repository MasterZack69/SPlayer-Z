import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings";
import { SONG_LIST_COLUMNS } from "@/utils/songListColumns";

/** Hydrate the real settings store with its persistence plugin. */
const mountStore = () => {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useSettingsStore();
};

beforeEach(() => localStorage.clear());

describe("song-list column preferences", () => {
  it("preserves the existing layout for older settings", () => {
    localStorage.setItem("settings", JSON.stringify({ appearance: { songListStyle: "compact" } }));
    const store = mountStore();
    expect(store.appearance.songListColumnOrder).toEqual(SONG_LIST_COLUMNS);
    expect(store.appearance.songListHiddenColumns).toEqual([]);
    expect(store.appearance.songListStyle).toBe("compact");
  });

  it("persists order and visibility across store hydration", async () => {
    const store = mountStore();
    store.appearance.songListColumnOrder = [
      "year",
      ...SONG_LIST_COLUMNS.filter((key) => key !== "year"),
    ];
    store.appearance.songListHiddenColumns = ["genre", "size"];
    await nextTick();
    const restored = mountStore();
    expect(restored.appearance.songListColumnOrder).toEqual(store.appearance.songListColumnOrder);
    expect(restored.appearance.songListHiddenColumns).toEqual(["genre", "size"]);
  });

  it("drops custom keys and duplicates without allowing the title to disappear", () => {
    localStorage.setItem(
      "settings",
      JSON.stringify({
        appearance: {
          songListColumnOrder: ["year", "year", "custom", "title"],
          songListHiddenColumns: ["title", "album", "custom", "album"],
        },
      }),
    );
    const store = mountStore();
    expect(store.appearance.songListColumnOrder).toEqual([
      "year",
      "title",
      "index",
      "album",
      "genre",
      "actions",
      "duration",
      "size",
    ]);
    expect(store.appearance.songListHiddenColumns).toEqual(["album"]);
  });
});

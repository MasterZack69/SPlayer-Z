import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import persistedState from "pinia-plugin-persistedstate";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { useBrowseSortStore } from "./browseSort";
import { useYearBrowserStore } from "./yearBrowser";

/** Create a fresh app session with production persistence enabled. */
const session = () => {
  const pinia = createPinia().use(persistedState);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return { sort: useBrowseSortStore(), years: useYearBrowserStore() };
};
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("permanent browser sorting", () => {
  it("restores independent category modes and year direction, not the selected year", async () => {
    const first = session();
    first.sort.yearOrder = "asc";
    first.sort.collectionModes.artist = "name";
    first.sort.collectionModes.album = "trackCount";
    first.sort.collectionModes.genre = "name";
    first.years.selectedId = "1999";
    await nextTick();
    const restarted = session();
    expect(restarted.sort.yearOrder).toBe("asc");
    expect(restarted.sort.collectionModes).toEqual({
      artist: "name",
      album: "trackCount",
      genre: "name",
    });
    expect(restarted.years.selectedId).toBe("");
    expect(localStorage.getItem("yearBrowser")).toBeNull();
  });
  it("keeps explicit changes back to the defaults after restarting", async () => {
    const first = session();
    first.sort.yearOrder = "asc";
    first.sort.collectionModes.genre = "trackCount";
    await nextTick();
    const changed = session();
    changed.sort.yearOrder = "desc";
    changed.sort.collectionModes.genre = "default";
    await nextTick();
    const restarted = session();
    expect(restarted.sort.yearOrder).toBe("desc");
    expect(restarted.sort.collectionModes.genre).toBe("default");
  });
});

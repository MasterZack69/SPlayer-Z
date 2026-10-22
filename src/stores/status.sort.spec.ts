import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { useStatusStore } from "./status";

/** Install the real persistence plugin before creating the status store. */
const mountStore = () => {
  const pinia = createPinia().use(piniaPluginPersistedstate);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useStatusStore();
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("persisted song-list sorting", () => {
  it("persists independent preferences including genre and hydrates them", async () => {
    const store = mountStore();
    store.setSortPreference("library", { field: "title", order: "asc" });
    store.setSortPreference("collection.album", { field: "track", order: "asc" });
    store.setSortPreference("collection.genre", { field: "artist", order: "desc" });
    await nextTick();
    const restored = mountStore();
    expect(restored.getSortPreference("library")).toEqual({ field: "title", order: "asc" });
    expect(restored.getSortPreference("collection.album")).toEqual({
      field: "track",
      order: "asc",
    });
    expect(restored.getSortPreference("collection.genre")).toEqual({
      field: "artist",
      order: "desc",
    });
    expect(restored.getSortPreference("folders")).toEqual({ field: "none", order: "asc" });
  });

  it("removes default entries, skips no-op writes and copies caller preferences", () => {
    const store = mountStore();
    const empty = store.sortPreferences;
    store.setSortPreference("library", { field: "none", order: "asc" });
    expect(store.sortPreferences).toBe(empty);
    const preference = { field: "title", order: "desc" } as const;
    store.setSortPreference("library", preference);
    expect(store.sortPreferences.library).not.toBe(preference);
    const saved = store.sortPreferences;
    store.setSortPreference("library", preference);
    expect(store.sortPreferences).toBe(saved);
    store.setSortPreference("library", { field: "none", order: "asc" });
    expect(store.sortPreferences).toEqual({});
  });

  it("does not spread a legacy global sort into every page on upgrade", async () => {
    localStorage.setItem(
      "status",
      JSON.stringify({ sortField: "title", sortOrder: "desc", volume: 0.4 }),
    );
    const store = mountStore();
    expect(store.volume).toBe(0.4);
    expect(store.getSortPreference("library")).toEqual({ field: "none", order: "asc" });
    expect(store.getSortPreference("collection.genre")).toEqual({ field: "none", order: "asc" });
    store.setSortPreference("library", { field: "title", order: "asc" });
    await nextTick();
    const saved = JSON.parse(localStorage.getItem("status")!);
    expect(saved).not.toHaveProperty("sortField");
    expect(saved).not.toHaveProperty("sortOrder");
  });
});

import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import persistedState from "pinia-plugin-persistedstate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings";

/** Hydrate the real settings store with its persistence plugin. */
const mountStore = () => {
  const pinia = createPinia().use(persistedState);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useSettingsStore();
};
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("lyric credit preference", () => {
  it("defaults to on for new and older saved settings", () => {
    expect(mountStore().lyric.showCredits).toBe(true);
    localStorage.setItem("settings", JSON.stringify({ lyric: { fontWeight: 500 } }));
    const settings = mountStore();
    expect(settings.lyric.showCredits).toBe(true);
    expect(settings.lyric.fontWeight).toBe(500);
  });

  it("persists disabling and re-enabling credits without restoring blend settings", async () => {
    const settings = mountStore();
    settings.lyric.showCredits = false;
    await nextTick();
    expect(mountStore().lyric.showCredits).toBe(false);
    settings.lyric.showCredits = true;
    await nextTick();
    expect(mountStore().lyric.showCredits).toBe(true);
    expect(settings.lyric).not.toHaveProperty("lyricBlendMode");
  });
});

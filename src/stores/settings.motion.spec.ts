import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "./settings";

let systemReduce = false;
vi.mock("@vueuse/core", async (original) => {
  const real = await original<typeof import("@vueuse/core")>();
  const { ref } = await import("vue");
  return {
    ...real,
    usePreferredReducedMotion: () => ref(systemReduce ? "reduce" : "no-preference"),
  };
});

/** Mount persistence so the real settings store hydrates and saves preferences. */
const mountStore = () => {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useSettingsStore();
};

beforeEach(() => {
  systemReduce = false;
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe("motion preferences", () => {
  it("defaults shared transitions and manual reduced motion to off", () => {
    const settings = mountStore();
    expect(settings.appearance.seamlessTransition).toBe(false);
    expect(settings.appearance.reduceMotion).toBe(false);
    expect(settings.reducedMotion).toBe(false);
  });

  it("honors manual reduced motion and persists both preferences", async () => {
    const settings = mountStore();
    settings.appearance.reduceMotion = true;
    settings.appearance.seamlessTransition = true;
    await nextTick();
    expect(settings.reducedMotion).toBe(true);
    const saved = JSON.parse(localStorage.getItem("settings")!);
    expect(saved.appearance).toMatchObject({ reduceMotion: true, seamlessTransition: true });
    const hydrated = mountStore();
    expect(hydrated.appearance).toMatchObject({ reduceMotion: true, seamlessTransition: true });
    expect(hydrated.reducedMotion).toBe(true);
  });

  it("honors the system preference even with the manual switch off", () => {
    systemReduce = true;
    expect(mountStore().reducedMotion).toBe(true);
  });

  it("adds defaults when older saved settings have no motion preferences", () => {
    localStorage.setItem("settings", JSON.stringify({ appearance: { routeTransition: "slide" } }));
    const settings = mountStore();
    expect(settings.appearance.routeTransition).toBe("slide");
    expect(settings.appearance.reduceMotion).toBe(false);
    expect(settings.appearance.seamlessTransition).toBe(false);
  });
});

import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "./settings";

vi.mock("@/stores/theme", () => ({ useThemeStore: () => ({}) }));
vi.mock("@/components/settings/custom/FontConfig.vue", () => ({ default: {} }));
vi.mock("@/components/settings/custom/BackgroundImagePicker.vue", () => ({ default: {} }));
vi.mock("@/components/settings/custom/SidebarCustomizeConfig.vue", () => ({ default: {} }));
vi.mock("@/components/settings/custom/SkipKeywordsConfig.vue", () => ({ default: {} }));
import appearanceCategory from "@/settings/categories/appearance";
import lyricCategory from "@/settings/categories/lyric";
import otherCategory from "@/settings/categories/other";

/** Create the real settings store with hydration and persistence installed. */
const mountStore = () => {
  const pinia = createPinia().use(piniaPluginPersistedstate);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useSettingsStore();
};
afterEach(() => localStorage.clear());

describe("retired display preferences", () => {
  it("does not expose beat, VIP or blend mode controls in settings search", () => {
    const schema = JSON.stringify([appearanceCategory, lyricCategory, otherCategory]);
    for (const key of ["playerBgBeat", "hideVipTag", "lyricBlendMode"])
      expect(schema).not.toContain(key);
  });

  it("does not include retired fields in new defaults", () => {
    const store = mountStore();
    expect(store.player).not.toHaveProperty("playerBgBeat");
    expect(store.preset).not.toHaveProperty("hideVipTag");
    expect(store.lyric).not.toHaveProperty("lyricBlendMode");
  });

  it.each(["screen", "plus-lighter"])(
    "discards saved %s blending and pulse preferences",
    async (blend) => {
      localStorage.setItem(
        "settings",
        JSON.stringify({
          player: { playerBgBeat: true, playerBgType: "fluid" },
          preset: { hideVipTag: false, hideQualityTag: true },
          lyric: { lyricBlendMode: blend, fontSize: 40 },
        }),
      );
      const store = mountStore();
      expect(store.player).not.toHaveProperty("playerBgBeat");
      expect(store.player.playerBgType).toBe("fluid");
      expect(store.preset).not.toHaveProperty("hideVipTag");
      expect(store.preset.hideQualityTag).toBe(true);
      expect(store.lyric).not.toHaveProperty("lyricBlendMode");
      expect(store.lyric.fontSize).toBe(40);
      store.lyric.fontSize = 42;
      await nextTick();
      const saved = localStorage.getItem("settings")!;
      for (const key of ["playerBgBeat", "hideVipTag", "lyricBlendMode"])
        expect(saved).not.toContain(key);
    },
  );
});

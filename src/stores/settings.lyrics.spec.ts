import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { afterEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings";
import lyricCategory from "@/settings/categories/lyric";

afterEach(() => localStorage.clear());

describe("AMLL lyric preferences", () => {
  it("removes retired engine settings during hydration and preserves AMLL preferences", async () => {
    Object.assign(window, {
      api: {
        window: {
          onTaskbarLyricVisibilityChange: () => () => {},
          isTaskbarLyricOpen: async () => false,
        },
      },
    });
    localStorage.setItem(
      "settings",
      JSON.stringify({
        lyric: {
          engine: "physics",
          alignment: "center",
          springPreset: "custom",
          springMass: 3,
          springDamping: 20,
          springStiffness: 75,
          inactiveAlpha: 0.3,
          enableWordHighlight: false,
          enableFloatAnimation: true,
          enableEmphasizeEffect: true,
          fontSize: 40,
          amllVerticalSpringMass: 2,
          useAMSpring: false,
        },
      }),
    );
    const pinia = createPinia();
    pinia.use(piniaPluginPersistedstate);
    const app = createApp({});
    app.use(pinia);
    setActivePinia(pinia);
    const store = useSettingsStore();
    expect(store.lyric).toMatchObject({
      fontSize: 40,
      amllVerticalSpringMass: 2,
      useAMSpring: false,
    });
    for (const key of [
      "engine",
      "alignment",
      "springPreset",
      "springMass",
      "springDamping",
      "springStiffness",
      "inactiveAlpha",
      "enableWordHighlight",
      "enableFloatAnimation",
      "enableEmphasizeEffect",
    ]) {
      expect(store.lyric).not.toHaveProperty(key);
    }
    store.lyric.fontSize = 42;
    await nextTick();
    expect(JSON.parse(localStorage.getItem("settings")!).lyric).not.toHaveProperty("engine");
  });

  it("exposes AMLL options without a renderer switch or inert legacy controls", () => {
    const keys = JSON.stringify(lyricCategory);
    expect(keys).not.toContain('"key":"engine"');
    expect(keys).not.toContain("lyric.springPreset");
    expect(keys).not.toContain("lyric.alignment");
    expect(
      lyricCategory.sections!.find((section) => section.id === "lyricAMLLOptimize")?.visible,
    ).toBeUndefined();
    const spring = lyricCategory.sections!.find((section) => section.id === "lyricSpring")!;
    expect(spring.items?.map((item) => item.key)).toEqual(["useAMSpring"]);
    expect(spring.items?.[0]?.visible).toBeUndefined();
  });
});

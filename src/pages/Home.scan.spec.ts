import { shallowMount, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";

const state = await vi.hoisted(async () => {
  const { reactive, ref } = await import("vue");
  return {
    library: reactive({ tracks: [] as unknown[], scanning: false, scanProgress: null }),
    loadHero: vi.fn(),
    loadHeader: vi.fn(),
    hero: ref(null),
  };
});
vi.mock("@/stores/library", () => ({ useLibraryStore: () => state.library }));
vi.mock("@/composables/home/useHomeHeader", () => ({
  useHomeHeader: () => ({ greetingTitle: "Good morning", headerStats: [], load: state.loadHeader }),
}));
vi.mock("@/composables/home/useDailyRecommend", () => ({
  useDailyRecommend: () => ({
    hero: state.hero,
    loading: false,
    previewTracks: [],
    load: state.loadHero,
  }),
}));
vi.mock("@/composables/useFloatingPlayerBar", () => ({
  useFloatingPlayerBar: () => ({ isFloatingBar: false }),
}));
vi.mock("@/components/stats/HomeStats.vue", () => ({ default: { template: "<section />" } }));
import Home from "./Home.vue";

describe("Home during setup indexing", () => {
  it("refreshes the random selection after indexing without Library navigation", async () => {
    const wrapper = shallowMount(Home, {
      global: {
        plugins: [createI18n({ legacy: false, locale: "en", messages: {} })],
        stubs: {
          HomeStats: true,
          SCard: true,
          SLoading: true,
          SImg: true,
          STag: true,
          SButton: true,
          IconLucidePlay: true,
          IconLucidePlus: true,
        },
      },
    });
    expect(state.loadHero).toHaveBeenCalledOnce();
    state.library.scanning = true;
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    state.library.tracks = [{ id: "indexed" }];
    state.library.scanning = false;
    await flushPromises();
    expect(state.loadHero).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
  });
});

import { defineComponent, h, reactive } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
import en from "@/i18n/locales/en-US.json";
const state = vi.hoisted(() => ({ library: null as unknown, streaming: null as unknown }));
vi.mock("@/stores/library", () => ({ useLibraryStore: () => state.library }));
vi.mock("@/stores/streaming", () => ({ useStreamingStore: () => state.streaming }));
import Years from "./Years.vue";
const song = (id: string, year?: number): Track => ({
  id,
  source: "local",
  title: id,
  artists: [],
  duration: 1000,
  year,
});
/** Render text year navigation and inspect the real list contract across route reuse. */
const setup = async () => {
  state.library = reactive({
    initialized: true,
    tracks: [song("older", 1999), song("newer", 2024), song("unknown")],
    load: vi.fn(),
  });
  state.streaming = reactive({
    songs: [{ ...song("remote", 2024), source: "streaming", serverId: "server" }],
    init: vi.fn().mockResolvedValue(undefined),
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/years/local", name: "year-list", component: Years },
      { path: "/years/local/:year", name: "year", component: Years },
    ],
  });
  await router.push("/years/local");
  const wrapper = mount(defineComponent({ setup: () => () => h(Years) }), {
    global: {
      plugins: [router, createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      stubs: {
        SongList: {
          name: "SongList",
          props: ["items", "searchQuery", "sortKey"],
          template: "<div data-year-songs />",
        },
      },
    },
  });
  await flushPromises();
  return { wrapper, router };
};
describe("Years browser", () => {
  it("shows only year text, then opens the centered year heading above matching songs", async () => {
    const { wrapper, router } = await setup();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["2024", "1999"]);
    expect(wrapper.find("img").exists()).toBe(false);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("2024");
    expect(wrapper.get("h1").classes()).toContain("text-center");
    expect(
      wrapper
        .getComponent({ name: "SongList" })
        .props("items")
        .map((track: Track) => track.id),
    ).toEqual(["newer", "remote"]);
    await router.push({ name: "year", params: { year: "1999" }, query: { filter: "old" } });
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("1999");
    expect(wrapper.getComponent({ name: "SongList" }).props("searchQuery")).toBe("old");
    wrapper.unmount();
  });
  it("filters the text year list using the contextual top search", async () => {
    const { wrapper, router } = await setup();
    await router.replace({ name: "year-list", query: { filter: "1999" } });
    await flushPromises();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["1999"]);
    wrapper.unmount();
  });
});

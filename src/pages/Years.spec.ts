import { defineComponent, h, reactive } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
import en from "@/i18n/locales/en-US.json";
const state = vi.hoisted(() => ({ library: null as unknown, streaming: null as unknown }));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => ({ reducedMotion: true }) }));
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
        SSelect: {
          name: "SSelect",
          props: ["modelValue", "options"],
          template: "<div data-year-sort />",
        },
        IconLucideListMusic: true,
        IconLucideHourglass: true,
        IconLucideArrowUpDown: true,
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
  it("keeps the text wheel beside the selected year songs across route changes", async () => {
    const { wrapper, router } = await setup();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "2024",
      "1999",
      "Unknown year",
    ]);
    expect(wrapper.find("img").exists()).toBe(false);
    const wheel = wrapper.get("[data-year-wheel]").element;
    expect(wrapper.getComponent({ name: "SongList" }).props("items")).toHaveLength(2);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Years");
    expect(wrapper.get("h2").text()).toBe("2024");
    expect(wrapper.get("[data-year-wheel]").element).toBe(wheel);
    expect(
      wrapper
        .getComponent({ name: "SongList" })
        .props("items")
        .map((track: Track) => track.id),
    ).toEqual(["newer", "remote"]);
    await router.push({ name: "year", params: { year: "1999" }, query: { filter: "old" } });
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("1999");
    expect(wrapper.getComponent({ name: "SongList" }).props("searchQuery")).toBe("old");
    wrapper.unmount();
  });
  it("opens unknown years without grouping valid album-only server years as missing", async () => {
    const { wrapper, router } = await setup();
    const streaming = state.streaming as { songs: Track[] };
    streaming.songs.push(
      { ...song("remote-missing", 0), source: "streaming" },
      { ...song("album-year"), source: "streaming", album: { name: "Album", year: 2024 } },
    );
    await flushPromises();
    const unknown = wrapper.findAll("button").find((button) => button.text() === "Unknown year")!;
    await unknown.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.params.year).toBe("unknown");
    expect(wrapper.get("h2").text()).toBe("Unknown year");
    expect(
      wrapper
        .getComponent({ name: "SongList" })
        .props("items")
        .map((track: Track) => track.id),
    ).toEqual(["unknown", "remote-missing"]);
    wrapper.unmount();
  });
  it("filters only songs in the selected year and leaves the year wheel unchanged", async () => {
    const { wrapper, router } = await setup();
    await router.replace({ name: "year-list", query: { filter: "newer" } });
    await flushPromises();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "2024",
      "1999",
      "Unknown year",
    ]);
    expect(wrapper.getComponent({ name: "SongList" }).props("searchQuery")).toBe("newer");
    expect(wrapper.get("h2").text()).toBe("2024");
    await wrapper.get('[data-year="1999"]').trigger("click");
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("1999");
    expect(wrapper.getComponent({ name: "SongList" }).props("searchQuery")).toBe("newer");
    expect(router.currentRoute.value.query.filter).toBe("newer");
    await router.replace({ query: {} });
    await flushPromises();
    expect(wrapper.getComponent({ name: "SongList" }).props("searchQuery")).toBe("");
    expect(
      wrapper
        .getComponent({ name: "SongList" })
        .props("items")
        .map((track: Track) => track.id),
    ).toEqual(["older"]);
    wrapper.unmount();
  });
});

describe("year sorting and summaries", () => {
  it("sorts numeric years in both directions and leaves unknown last", async () => {
    const { wrapper, router } = await setup();
    const control = wrapper.getComponent({ name: "SSelect" });
    expect(control.props("modelValue")).toBe("desc");
    expect(control.props("options")).toEqual([
      { value: "asc", label: "Ascending" },
      { value: "desc", label: "Descending" },
    ]);
    control.vm.$emit("update:modelValue", "asc");
    await flushPromises();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "1999",
      "2024",
      "Unknown year",
    ]);
    await router.replace({ name: "year-list", query: { filter: "1999" } });
    await flushPromises();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "1999",
      "2024",
      "Unknown year",
    ]);
    await router.replace({ name: "year-list" });
    control.vm.$emit("update:modelValue", "desc");
    await flushPromises();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "2024",
      "1999",
      "Unknown year",
    ]);
    wrapper.unmount();
  });
  it("shows the selected count and duration above the song pane, independent of its filter", async () => {
    const { wrapper, router } = await setup();
    const library = state.library as { tracks: Track[] };
    const streaming = state.streaming as { songs: Track[] };
    library.tracks.find((track) => track.year === 2024)!.duration = 3600000;
    streaming.songs[0].duration = 90000;
    await router.push({ name: "year", params: { year: "2024" }, query: { filter: "newer" } });
    await flushPromises();
    expect(wrapper.findComponent({ name: "SSelect" }).exists()).toBe(true);
    const summary = wrapper.get("[data-year-summary]");
    expect(
      summary.classes().some((name) => name.startsWith("border") || name.startsWith("bg-")),
    ).toBe(false);
    expect(summary.get("div").classes()).toContain("justify-center");
    expect(summary.text()).toContain("2 songs");
    expect(summary.text()).toContain("About 1:01:30");
    await router.push({ name: "year", params: { year: "unknown" } });
    await flushPromises();
    expect(wrapper.get("[data-year-summary]").text()).toContain("1 songs");
    expect(wrapper.get("[data-year-summary]").text()).toContain("About 0:01");
    await router.push({ name: "year", params: { year: "1900" } });
    await flushPromises();
    expect(wrapper.get("[data-year-summary]").text()).toContain("0 songs");
    expect(wrapper.get("[data-year-summary]").text()).toContain("About 0:00");
    wrapper.unmount();
  });
});

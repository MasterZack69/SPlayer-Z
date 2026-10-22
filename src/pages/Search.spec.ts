/* eslint-disable vue/one-component-per-file -- Lightweight result and navigation fixtures. */
import { defineComponent, h, reactive } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/locales/en-US.json";
import type { Track } from "@shared/types/player";
import type { CoverItem } from "@/types/artist";

vi.mock("@/stores/library", () => ({ useLibraryStore: () => library }));
vi.mock("@/stores/playlist", () => ({ usePlaylistStore: () => playlists }));
vi.mock("@/stores/streaming", () => ({ useStreamingStore: () => streaming }));
vi.mock("@/utils/navigate", () => ({ navigateToResource: vi.fn() }));
import { navigateToResource } from "@/utils/navigate";
import Search from "./Search.vue";
import NavSearch from "@/components/layout/NavSearch.vue";

const track: Track = {
  id: "song",
  source: "local",
  title: "Night Song",
  duration: 180000,
  artists: [{ name: "Night Artist" }],
  album: { name: "Night Album" },
  genres: ["Night Pop"],
};
const library = reactive({
  initialized: true,
  tracks: [track],
  folderTree: [{ name: "Night Folder", path: "/music/night", children: [], tracks: [track] }],
  load: vi.fn().mockResolvedValue(undefined),
});
const playlists = reactive({
  initialized: true,
  playlists: [{ id: "local", title: "Night Mix", trackCount: 1 }],
  load: vi.fn().mockResolvedValue(undefined),
});
const streaming = reactive({
  activeServerId: "server-a",
  songs: [] as Track[],
  albums: [{ id: "remote", name: "Night Remote Album", serverId: "server-a" }],
  artists: [],
  playlists: [],
  loading: false,
  init: vi.fn().mockResolvedValue(undefined),
});
const SongList = defineComponent({
  props: { items: { type: Array, required: true } },
  setup: (props) => () =>
    h(
      "div",
      { "data-songs": "" },
      (props.items as Track[]).map((song) => h("div", song.title)),
    ),
});
const CoverList = defineComponent({
  props: { items: { type: Array, required: true } },
  emits: ["click"],
  setup:
    (props, { emit }) =>
    () =>
      h(
        "div",
        { "data-covers": "" },
        (props.items as CoverItem[]).map((item) =>
          h("button", { "data-title": item.title, onClick: () => emit("click", item) }, item.title),
        ),
      ),
});
const Tabs = defineComponent({
  props: { tabs: { type: Array, required: true } },
  emits: ["update:modelValue"],
  setup:
    (props, { emit }) =>
    () =>
      h(
        "nav",
        (props.tabs as { key: string; label: string }[]).map((tab) =>
          h(
            "button",
            { "data-category": tab.key, onClick: () => emit("update:modelValue", tab.key) },
            tab.label,
          ),
        ),
      ),
});
const Input = defineComponent({
  props: { modelValue: String },
  emits: ["update:modelValue"],
  setup:
    (props, { emit }) =>
    () =>
      h("div", [
        h("input", { value: props.modelValue }),
        h("button", { "data-clear": "", onClick: () => emit("update:modelValue", "") }, "Clear"),
      ]),
});

/**
 * Mount global search and its top input with isolated library snapshots.
 * @param path - Initial search route.
 * @returns Mounted view and router for navigation assertions.
 */
const setup = async (path = "/search?q=Night") => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/search", name: "search", component: Search },
      { path: "/years/local/:year", name: "year", component: { render: () => null } },
      { path: "/folders", name: "folders", component: { render: () => null } },
    ],
  });
  await router.push(path);
  const Host = defineComponent({ setup: () => () => h("div", [h(NavSearch), h(Search)]) });
  const wrapper = mount(Host, {
    global: {
      plugins: [router, createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      stubs: {
        SongList,
        CoverList,
        STabs: Tabs,
        NavSearchInput: Input,
        SButton: { template: "<button><slot /></button>" },
      },
    },
  });
  await flushPromises();
  return { wrapper, router };
};

beforeEach(() => {
  library.initialized = true;
  library.load.mockReset().mockResolvedValue(undefined);
  library.tracks = [track];
  playlists.initialized = true;
});

describe("categorized global search view", () => {
  it("renders translated headings and all six result categories without public API calls", async () => {
    const { wrapper } = await setup();
    expect(wrapper.get("h1").text()).toBe("Search: Night");
    expect(wrapper.text()).not.toContain("nav.search");
    expect(wrapper.findAll("h2").map((heading) => heading.text())).toEqual([
      "Songs (1)",
      "Albums (2)",
      "Artists (1)",
      "Genres (1)",
      "Playlists (1)",
      "Folders (1)",
    ]);
    expect(library.load).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("removes all rendered results when the top input is cleared", async () => {
    const { wrapper, router } = await setup();
    await wrapper.get("[data-clear]").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({});
    expect(wrapper.find("[data-songs]").exists()).toBe(false);
    expect(wrapper.find("[data-covers]").exists()).toBe(false);
    expect(wrapper.text()).toContain(en.search.emptyKeyword);
    wrapper.unmount();
  });
  it("switches categories and preserves the submitted keyword", async () => {
    const { wrapper, router } = await setup();
    await wrapper.get('[data-category="albums"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ q: "Night", category: "albums" });
    expect(wrapper.find("[data-songs]").exists()).toBe(false);
    expect(wrapper.findAll("[data-title]")).toHaveLength(2);
    wrapper.unmount();
  });
  it("navigates server album results with the correct server and resource IDs", async () => {
    const { wrapper } = await setup();
    await wrapper.get('[data-title="Night Remote Album"]').trigger("click");
    expect(navigateToResource).toHaveBeenCalledWith({
      type: "album",
      source: "streaming",
      id: "remote",
      name: "Night Remote Album",
      serverId: "server-a",
    });
    wrapper.unmount();
  });
  it("opens a folder result at its actual filesystem path", async () => {
    const { wrapper, router } = await setup();
    await wrapper.get('[data-title="Night Folder"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({
      name: "folders",
      query: { path: "/music/night" },
    });
    wrapper.unmount();
  });
  it("opens a genre as an exact cross-library song filter", async () => {
    const { wrapper, router } = await setup();
    await wrapper.get('[data-title="Night Pop"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({
      q: "Night Pop",
      category: "songs",
      genre: "Night Pop",
    });
    expect(wrapper.get("[data-songs]").text()).toBe("Night Song");
    wrapper.unmount();
  });
  it("shows category-specific empty results without hiding other category counts", async () => {
    const { wrapper } = await setup("/search?q=Night%20Mix&category=albums");
    expect(wrapper.text()).toContain(en.search.noResults);
    expect(wrapper.get('[data-category="playlists"]').text()).toBe("Playlists (1)");
    wrapper.unmount();
  });
  it("keeps available results visible when one library fails to load", async () => {
    library.initialized = false;
    library.load.mockRejectedValue(new Error("Database unavailable"));
    const { wrapper } = await setup();
    expect(wrapper.get('[role="alert"]').text()).toContain(en.search.partialError);
    expect(wrapper.get("[data-songs]").text()).toBe("Night Song");
    wrapper.unmount();
  });
});

it("renders year results as text links and opens the year's songs", async () => {
  library.tracks = [{ ...track, year: 2024 }];
  const { wrapper, router } = await setup("/search?q=2024&category=years");
  expect(wrapper.find("[data-covers]").exists()).toBe(false);
  const yearButton = wrapper.findAll("button").find((button) => button.text() === "2024");
  expect(yearButton).toBeDefined();
  await yearButton!.trigger("click");
  await flushPromises();
  expect(router.currentRoute.value.name).toBe("year");
  expect(router.currentRoute.value.params.year).toBe("2024");
  wrapper.unmount();
});

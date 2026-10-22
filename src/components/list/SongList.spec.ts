import { defineComponent, h, ref, type PropType } from "vue";
import { shallowMount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import en from "@/i18n/locales/en-US.json";
import type { Track } from "@shared/types/player";

import { createPinia, setActivePinia } from "pinia";
import { useStatusStore } from "@/stores/status";
beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});
vi.mock("vue-router", () => ({ useRoute: () => ({ name: "library" }) }));
vi.mock("@/stores/media", () => ({ useMediaStore: () => ({ track: null }) }));
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({ preset: {}, player: {} }),
}));
vi.mock("@/core/player", () => ({ playNow: vi.fn(), playFrom: vi.fn() }));
vi.mock("@/utils/navigate", () => ({
  navigateToAlbum: vi.fn(),
  navigateToArtist: vi.fn(),
  navigateToGenre: vi.fn(),
}));
vi.mock("@/composables/useTrackMenu", () => ({
  useTrackMenu: () => ({ items: ref([]), handleSelect: vi.fn() }),
}));
vi.mock("@/composables/useMultiSelect", () => ({
  useMultiSelect: () => ({
    active: ref(false),
    selectedIds: ref(new Set()),
    deleteConfirmOpen: ref(false),
    deleteDialogTitle: ref(""),
    deleteDialogContent: ref(""),
    enter: vi.fn(),
    exit: vi.fn(),
  }),
}));
vi.mock("@/composables/useFavorite", () => ({
  useFavorite: () => ({ isSupported: () => true, isLiked: () => false }),
}));
vi.mock("@/composables/usePlaylistPicker", () => ({
  usePlaylistPicker: () => ({
    open: ref(false),
    tracks: ref([]),
    mode: ref("local"),
    openPicker: vi.fn(),
  }),
}));
vi.mock("@/composables/useFloatingPlayerBar", () => ({
  useFloatingPlayerBar: () => ({ isFloatingBar: ref(false), PLAYER_BAR_GAP: 112 }),
}));
import SongList from "./SongList.vue";

const track: Track = {
  id: "song",
  source: "local",
  title: "Test Song",
  artists: [{ name: "Test Artist" }],
  album: { name: "Test Album" },
  genres: ["Pop"],
  duration: 180000,
  fileSize: 30000000,
};
const RadioGroup = {
  name: "TestRadioGroup",
  props: { value: String },
  emits: ["update:value"],
  template: "<div><slot /></div>",
};
const VirtualList = defineComponent({
  name: "TestVirtualList",
  props: { items: { type: Array as PropType<Track[]>, default: () => [] } },
  setup:
    (props, { slots }) =>
    () =>
      h("div", [
        slots.header?.(),
        ...(props.items as Track[]).map((item, index) => slots.default?.({ item, index })),
      ]),
});
/** Mount the real list while keeping virtualization and unrelated popovers out of the test. */
const mountList = (props: Record<string, unknown> = {}) =>
  shallowMount(SongList, {
    props: { items: [track], ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      config: { warnHandler: () => {} },
      stubs: {
        SPopover: { template: '<div><slot name="trigger" /><slot /></div>' },
        SRadioGroup: RadioGroup,
        SContextMenu: { template: "<div><slot /></div>" },
        SVirtualList: VirtualList,
        SDialog: true,
        PlaylistPickerDialog: true,
        TagEditorDialog: true,
      },
    },
  });

describe("shared song-list columns", () => {
  it("never renders obsolete VIP or paid EP labels", () => {
    const wrapper = mountList({
      items: [
        { ...track, id: "vip", fee: 1 },
        { ...track, id: "ep", fee: 4 },
      ],
    });
    expect(wrapper.text()).not.toContain("VIP");
    expect(wrapper.text()).not.toContain("EP");
    wrapper.unmount();
  });

  it("shows Album, Genre, Actions, Duration, and Size by default", () => {
    const wrapper = mountList();
    const header = wrapper.get("[data-song-header]");
    for (const label of ["Album", "Genre", "Year", "Actions", "Duration", "Size"])
      expect(header.text()).toContain(label);
    expect(wrapper.get("[data-song-item]").text()).toContain("Pop");
    expect(header.element.children).toHaveLength(8);
    expect(wrapper.get("[data-song-item]").element.children).toHaveLength(8);
    expect(header.attributes("style")).toBe(wrapper.get("[data-song-item]").attributes("style"));
    wrapper.unmount();
  });
  it("updates header and row tracks together when optional columns change", async () => {
    const wrapper = mountList();
    await wrapper.setProps({ showAlbum: false, showGenre: false, showSize: false });
    expect(wrapper.get("[data-song-header]").element.children).toHaveLength(5);
    expect(wrapper.get("[data-song-item]").element.children).toHaveLength(5);
    expect(wrapper.get("[data-song-header]").attributes("style")).toBe(
      wrapper.get("[data-song-item]").attributes("style"),
    );
    wrapper.unmount();
  });
  it("uses the same default columns on every full song-list page", () => {
    for (const page of [
      "Artist",
      "Collection",
      "Folders",
      "Liked",
      "Library",
      "Search",
      "Streaming/Songs",
    ]) {
      const source = readFileSync(`src/pages/${page}.vue`, "utf8");
      expect(source).toContain("<SongList");
      expect(source).not.toMatch(/:show-(?:album|genre|duration|size)=/);
    }
  });
});

/** Change the real list's sorting controls through their model events. */
const setSort = async (wrapper: ReturnType<typeof mountList>, field: string, order = "asc") => {
  const controls = wrapper.findAllComponents(RadioGroup);
  controls[0].vm.$emit("update:value", field);
  controls[1].vm.$emit("update:value", order);
  await wrapper.vm.$nextTick();
};

/** Read the order supplied to virtualization, not the input array. */
const titles = (wrapper: ReturnType<typeof mountList>) =>
  wrapper
    .findComponent({ name: "TestVirtualList" })
    .props("items")
    .map((item: Track) => item.title);

const sortTracks = [
  { ...track, id: "z", title: "Zulu" },
  { ...track, id: "a", title: "Alpha" },
];

describe("song-list sorting scopes", () => {
  it("isolates Library, album and genre sorting while preserving source order", async () => {
    const library = mountList({ items: sortTracks, enableSort: true, sortKey: "library" });
    const album = mountList({ items: sortTracks, enableSort: true, sortKey: "collection.album" });
    const genre = mountList({ items: sortTracks, enableSort: true, sortKey: "collection.genre" });
    await setSort(library, "title");
    expect(titles(library)).toEqual(["Alpha", "Zulu"]);
    expect(titles(album)).toEqual(["Zulu", "Alpha"]);
    expect(titles(genre)).toEqual(["Zulu", "Alpha"]);
    await setSort(genre, "title", "desc");
    expect(titles(library)).toEqual(["Alpha", "Zulu"]);
    expect(titles(genre)).toEqual(["Zulu", "Alpha"]);
    expect(sortTracks.map((item) => item.title)).toEqual(["Zulu", "Alpha"]);
    library.unmount();
    album.unmount();
    genre.unmount();
  });

  it("reuses a category preference after remounting", async () => {
    const first = mountList({ items: sortTracks, enableSort: true, sortKey: "artist" });
    await setSort(first, "title");
    first.unmount();
    const second = mountList({ items: sortTracks, enableSort: true, sortKey: "artist" });
    expect(titles(second)).toEqual(["Alpha", "Zulu"]);
    second.unmount();
  });

  it("keeps unkeyed lists independent and does not persist their sorting", async () => {
    const first = mountList({ items: sortTracks, enableSort: true });
    const second = mountList({ items: sortTracks, enableSort: true });
    await setSort(first, "title");
    expect(titles(first)).toEqual(["Alpha", "Zulu"]);
    expect(titles(second)).toEqual(["Zulu", "Alpha"]);
    expect(useStatusStore().sortPreferences).toEqual({});
    first.unmount();
    second.unmount();
  });

  it("switches sort keys reactively and ignores sorting when disabled", async () => {
    const list = mountList({ items: sortTracks, enableSort: true, sortKey: "library" });
    await setSort(list, "title");
    await list.setProps({ sortKey: "folders" });
    expect(titles(list)).toEqual(["Zulu", "Alpha"]);
    await list.setProps({ sortKey: "library" });
    expect(titles(list)).toEqual(["Alpha", "Zulu"]);
    await list.setProps({ enableSort: false });
    expect(titles(list)).toEqual(["Zulu", "Alpha"]);
    list.unmount();
  });
});

describe("year sorting", () => {
  it("sorts numerically and keeps unknown years last in both directions", async () => {
    const wrapper = mountList({
      enableSort: true,
      items: [
        { ...track, id: "unknown", title: "Unknown" },
        { ...track, id: "new", title: "New", year: 2024 },
        { ...track, id: "old", title: "Old", year: 1999 },
      ],
    });
    await setSort(wrapper, "year");
    expect(titles(wrapper)).toEqual(["Old", "New", "Unknown"]);
    await setSort(wrapper, "year", "desc");
    expect(titles(wrapper)).toEqual(["New", "Old", "Unknown"]);
    expect(wrapper.get("[data-song-header]").element.children[4].textContent).toBe("Year");
    wrapper.unmount();
  });
});

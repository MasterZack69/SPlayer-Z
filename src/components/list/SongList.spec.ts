import { defineComponent, h, ref, reactive, type PropType } from "vue";
import { shallowMount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import en from "@/i18n/locales/en-US.json";
import { SONG_LIST_COLUMNS, type SongListColumn } from "@/utils/songListColumns";
import type { Track } from "@shared/types/player";

import { createPinia, setActivePinia } from "pinia";
import { useStatusStore } from "@/stores/status";
beforeEach(() => {
  localStorage.clear();
  appearance.songListStyle = "comfortable";
  appearance.songListColumnOrder = [...SONG_LIST_COLUMNS];
  appearance.songListHiddenColumns = [];
  preset.ignoreMusicGenre = true;
  setActivePinia(createPinia());
});
const preset = reactive({ ignoreMusicGenre: true });
const appearance = reactive({
  songListStyle: "comfortable",
  songListColumnOrder: [...SONG_LIST_COLUMNS],
  songListHiddenColumns: [] as SongListColumn[],
});
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("vue-router", () => ({
  useRoute: () => ({ name: "library" }),
  useRouter: () => navigation,
}));
vi.mock("@/stores/media", () => ({ useMediaStore: () => ({ track: null }) }));
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({ preset, player: {}, appearance }),
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
  it("switches density without losing shared year/header alignment", async () => {
    const wrapper = mountList();
    expect(wrapper.get("[data-song-item]").classes()).toContain("h-19");
    appearance.songListStyle = "compact";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-song-item]").classes()).toContain("h-14");
    expect(wrapper.get("[data-song-header]").attributes("style")).toBe(
      wrapper.get("[data-song-item]").attributes("style"),
    );
    expect(wrapper.get("[data-song-item]").element.children).toHaveLength(8);
    wrapper.unmount();
  });
  it("hides optional columns and keeps reordered header and row cells aligned", async () => {
    const wrapper = mountList();
    appearance.songListColumnOrder = [
      "year",
      "title",
      "index",
      "album",
      "genre",
      "actions",
      "duration",
      "size",
    ];
    appearance.songListHiddenColumns = ["album", "genre", "size", "index", "actions"];
    await wrapper.vm.$nextTick();
    const header = wrapper.get("[data-song-header]");
    const row = wrapper.get("[data-song-item]");
    expect(header.findAll("[data-song-column]")).toHaveLength(3);
    expect(row.findAll("[data-song-column]")).toHaveLength(3);
    for (const [column, position] of [
      ["year", 1],
      ["title", 2],
      ["duration", 3],
    ] as const) {
      expect(header.get(`[data-song-column="${column}"]`).attributes("style")).toContain(
        `grid-column: ${position}`,
      );
      expect(row.get(`[data-song-column="${column}"]`).attributes("style")).toBe(
        header.get(`[data-song-column="${column}"]`).attributes("style"),
      );
    }
    expect(header.attributes("style")).toBe(row.attributes("style"));
    wrapper.unmount();
  });

  it("keeps title visible when every optional column is hidden", async () => {
    appearance.songListHiddenColumns = [...SONG_LIST_COLUMNS];
    const wrapper = mountList();
    expect(wrapper.get("[data-song-header]").element.children).toHaveLength(1);
    expect(wrapper.get("[data-song-item]").element.children).toHaveLength(1);
    expect(wrapper.get("[data-song-item]").text()).toContain("Test Song");
    wrapper.unmount();
  });

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

describe("song-list year links", () => {
  it("opens local, album-only server, and unknown years without starting playback", async () => {
    const wrapper = mountList({
      items: [
        { ...track, id: "local", year: 2024 },
        { ...track, id: "remote", source: "streaming", album: { name: "Album", year: 1999 } },
        { ...track, id: "unknown" },
      ],
    });
    const links = wrapper.findAll("[data-year-link]");
    for (const [i, year] of [2024, 1999, "unknown"].entries()) {
      await links[i].trigger("click");
      expect(navigation.push).toHaveBeenLastCalledWith({ name: "year", params: { year } });
      await links[i].trigger("dblclick");
    }
    const player = await import("@/core/player");
    expect(player.playNow).not.toHaveBeenCalled();
    expect(player.playFrom).not.toHaveBeenCalled();
    expect(links[2].attributes("aria-label")).toBe("Unknown year");
    wrapper.unmount();
  });
});

describe("unknown-genre song links", () => {
  it("opens the unknown genre entry without triggering row playback", async () => {
    const wrapper = mountList({ items: [{ ...track, genres: [] }] });
    const link = wrapper.get("[data-unknown-genre-link]");
    await link.trigger("click");
    expect(navigation.push).toHaveBeenLastCalledWith({ name: "unknown-genre" });
    await link.trigger("dblclick");
    const player = await import("@/core/player");
    expect(player.playNow).not.toHaveBeenCalled();
    expect(player.playFrom).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

describe("Music genre display preference", () => {
  it("hides only the exact generic label and restores it without changing tags", async () => {
    const genres = ["Dubstep", " Music ", "Electronic Music", "Podcast"];
    const wrapper = mountList({ showGenre: true, items: [{ ...track, genres }] });
    expect(wrapper.find('[title="Dubstep / Electronic Music / Podcast"]').exists()).toBe(true);
    preset.ignoreMusicGenre = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[title="Dubstep / Music / Electronic Music / Podcast"]').exists()).toBe(
      true,
    );
    expect(genres).toEqual(["Dubstep", " Music ", "Electronic Music", "Podcast"]);
    wrapper.unmount();
  });
  it("links a Music-only song to Unknown Genre only while ignoring Music", async () => {
    const wrapper = mountList({ showGenre: true, items: [{ ...track, genres: ["Music"] }] });
    expect(wrapper.find("[data-unknown-genre-link]").exists()).toBe(true);
    preset.ignoreMusicGenre = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-unknown-genre-link]").exists()).toBe(false);
    expect(wrapper.find('[title="Music"]').exists()).toBe(true);
    wrapper.unmount();
  });
});

describe("album disc sections", () => {
  const albumTracks: Track[] = [
    { ...track, id: "disc2-track7", disc: 2, track: 7, discTitle: "Bonus", title: "Finale" },
    { ...track, id: "disc1-track3", track: 3, title: "Third" },
    { ...track, id: "disc1-track1", disc: 1, track: 1, title: "Opening" },
    { ...track, id: "disc2-track1", disc: 2, track: 1, title: "Encore" },
  ];
  it("groups discs and tagged track numbers without inserting fake playback rows", () => {
    const wrapper = mountList({ items: albumTracks, collectionType: "album" });
    expect(wrapper.findAll("h2").map((heading) => heading.text().replace(/\s+/g, " "))).toEqual([
      "Disc 1",
      "Disc 2 · Bonus",
    ]);
    expect(
      wrapper
        .findAll("[data-song-item]")
        .map((row) => row.get('[data-song-column="index"]').text()),
    ).toEqual(["1", "3", "1", "7"]);
    expect(wrapper.findComponent(VirtualList).props("items")).toHaveLength(4);
    wrapper.unmount();
  });
  it("retains disc title, original track number and album disc count when searching", () => {
    const wrapper = mountList({
      items: albumTracks,
      collectionType: "album",
      searchQuery: "Finale",
    });
    expect(wrapper.get("h2").text().replace(/\s+/g, " ")).toBe("Disc 2 · Bonus");
    expect(wrapper.get('[data-song-item] [data-song-column="index"]').text()).toBe("7");
    expect(wrapper.text()).toContain("2 songs");
    wrapper.unmount();
  });
  it("does not add sections to non-album or single-disc lists", () => {
    for (const props of [
      { items: albumTracks },
      { items: albumTracks.slice(0, 1), collectionType: "album" },
    ]) {
      const wrapper = mountList(props);
      expect(wrapper.find("h2").exists()).toBe(false);
      wrapper.unmount();
    }
  });
  it("keeps double-click playback indexes aligned with real tracks across disc headings", async () => {
    const wrapper = mountList({ items: albumTracks, collectionType: "album" });
    await wrapper.findAll("[data-song-item]")[2].trigger("dblclick");
    const player = await import("@/core/player");
    expect(player.playFrom).toHaveBeenLastCalledWith(
      [albumTracks[2], albumTracks[1], albumTracks[3], albumTracks[0]],
      { startIndex: 2, context: undefined },
    );
    wrapper.unmount();
  });
  it("lets explicit sorting override disc grouping", async () => {
    const wrapper = mountList({ items: albumTracks, collectionType: "album", enableSort: true });
    await wrapper.findAllComponents(RadioGroup)[0].vm.$emit("update:value", "title");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("h2").exists()).toBe(false);
    expect(
      (wrapper.findComponent(VirtualList).props("items") ?? []).map((item: Track) => item.title),
    ).toEqual(["Encore", "Finale", "Opening", "Third"]);
    wrapper.unmount();
  });
  it("updates exact virtual heights when changing row density", async () => {
    const wrapper = mountList({ items: albumTracks, collectionType: "album" });
    expect(wrapper.findComponent(VirtualList).attributes("exact-item-heights")).toBe(
      "128,88,128,88",
    );
    appearance.songListStyle = "compact";
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(VirtualList).attributes("exact-item-heights")).toBe("96,56,96,56");
    wrapper.unmount();
  });
});

import { defineComponent, h, reactive, ref, toRefs, type PropType } from "vue";
import { shallowMount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import en from "@/i18n/locales/en-US.json";
import type { Track } from "@shared/types/player";

vi.mock("pinia", () => ({ storeToRefs: (store: object) => toRefs(store) }));
vi.mock("vue-router", () => ({ useRoute: () => ({ name: "library" }) }));
vi.mock("@/stores/media", () => ({ useMediaStore: () => ({ track: null }) }));
vi.mock("@/stores/status", () => ({
  useStatusStore: () => reactive({ sortField: "none", sortOrder: "asc", isPlaying: false }),
}));
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
const VirtualList = defineComponent({
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
        SContextMenu: { template: "<div><slot /></div>" },
        SVirtualList: VirtualList,
        SDialog: true,
        PlaylistPickerDialog: true,
        TagEditorDialog: true,
      },
    },
  });

describe("shared song-list columns", () => {
  it("shows Album, Genre, Actions, Duration, and Size by default", () => {
    const wrapper = mountList();
    const header = wrapper.get("[data-song-header]");
    for (const label of ["Album", "Genre", "Actions", "Duration", "Size"])
      expect(header.text()).toContain(label);
    expect(wrapper.get("[data-song-item]").text()).toContain("Pop");
    expect(header.element.children).toHaveLength(7);
    expect(wrapper.get("[data-song-item]").element.children).toHaveLength(7);
    expect(header.attributes("style")).toBe(wrapper.get("[data-song-item]").attributes("style"));
    wrapper.unmount();
  });
  it("updates header and row tracks together when optional columns change", async () => {
    const wrapper = mountList();
    await wrapper.setProps({ showAlbum: false, showGenre: false, showSize: false });
    expect(wrapper.get("[data-song-header]").element.children).toHaveLength(4);
    expect(wrapper.get("[data-song-item]").element.children).toHaveLength(4);
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

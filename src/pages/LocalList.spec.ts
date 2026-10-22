import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/locales/en-US.json";
import type { CoverItem } from "@/types/artist";
import type { Track } from "@shared/types/player";

const mocks = vi.hoisted(() => ({
  libraryTracks: [] as Track[],
  getArtistList: vi.fn(),
  getAlbumList: vi.fn(),
  getGenreList: vi.fn(),
  getArtistProfile: vi.fn(),
  getAlbumCollection: vi.fn(),
  getGenreCollection: vi.fn(),
  loadArtistAvatars: vi.fn(),
  playFrom: vi.fn(),
  navigateToGenre: vi.fn(),
  navigateToAlbum: vi.fn(),
  navigateToArtist: vi.fn(),
}));
vi.mock("@/stores/library", () => ({
  useLibraryStore: () => ({
    ...mocks,
    tracks: mocks.libraryTracks,
    initialized: true,
    artistAvatars: ref({}),
  }),
}));
vi.mock("@/core/player", () => ({ playFrom: mocks.playFrom }));
vi.mock("@/utils/navigate", () => ({
  navigateToGenre: mocks.navigateToGenre,
  navigateToAlbum: mocks.navigateToAlbum,
  navigateToArtist: mocks.navigateToArtist,
}));
import LocalList from "./LocalList.vue";

const tracks: Track[] = [
  {
    id: "genre-song",
    source: "local",
    title: "Genre Song",
    duration: 180000,
    artists: [{ name: "Artist" }],
  },
  {
    id: "second-song",
    source: "local",
    title: "Second Song",
    duration: 120000,
    artists: [{ name: "Artist" }],
  },
];
const name = "Rock / Pop";
const CoverList = defineComponent({
  props: { items: { type: Array, required: true } },
  emits: ["click", "play"],
  setup:
    (props, { emit }) =>
    () =>
      h(
        "div",
        (props.items as CoverItem[]).map((item) =>
          h("div", { onClick: () => emit("click", item) }, [
            h(
              "button",
              {
                "data-play": "",
                onClick: (event: MouseEvent) => {
                  event.stopPropagation();
                  emit("play", item);
                },
              },
              item.title,
            ),
          ]),
        ),
      ),
});

/**
 * Mount a local collection list with isolated data and navigation.
 * @param mode - Collection category to exercise.
 * @returns Mounted collection list.
 */
const setup = async (mode: "genre" | "album" | "artist" = "genre") => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/list", name: `${mode}-list`, component: { render: () => null } },
      { path: "/genres/local/unknown", name: "unknown-genre", component: { render: () => null } },
    ],
  });
  await router.push("/list");
  const wrapper = mount(LocalList, {
    global: {
      plugins: [router, createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      stubs: {
        CoverList,
        SSelect: true,
        SButton: true,
        SongList: { name: "SongList", props: ["items", "searchQuery"], template: "<div />" },
      },
    },
  });
  await flushPromises();
  return wrapper;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.libraryTracks = [];
  for (const load of [mocks.getGenreList, mocks.getAlbumList, mocks.getArtistList]) {
    load.mockResolvedValue([{ name, artist: "Artist", trackCount: tracks.length }]);
  }
  for (const load of [mocks.getGenreCollection, mocks.getAlbumCollection, mocks.getArtistProfile]) {
    load.mockResolvedValue({ tracks });
  }
  mocks.playFrom.mockResolvedValue(undefined);
});

describe("local collection cover playback", () => {
  it.each(["genre", "album", "artist"] as const)(
    "plays %s tracks with the right queue context",
    async (mode) => {
      const wrapper = await setup(mode);
      await wrapper.get("[data-play]").trigger("click");
      await flushPromises();
      const loader =
        mode === "genre"
          ? mocks.getGenreCollection
          : mode === "album"
            ? mocks.getAlbumCollection
            : mocks.getArtistProfile;
      expect(loader).toHaveBeenCalledWith(name);
      if (mode !== "album") expect(mocks.getAlbumCollection).not.toHaveBeenCalled();
      expect(mocks.playFrom).toHaveBeenCalledWith(tracks, {
        startIndex: 0,
        context: { provider: "local", originId: name, originType: mode, originName: name },
      });
      expect(mocks.navigateToGenre).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it("does not replace playback for an empty genre", async () => {
    mocks.getGenreCollection.mockResolvedValue({ tracks: [] });
    const wrapper = await setup();
    await wrapper.get("[data-play]").trigger("click");
    await flushPromises();
    expect(mocks.playFrom).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("suppresses repeated clicks while genre tracks are loading", async () => {
    let resolve!: (value: { tracks: Track[] }) => void;
    mocks.getGenreCollection.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = await setup();
    await wrapper.get("[data-play]").trigger("click");
    await wrapper.get("[data-play]").trigger("click");
    expect(mocks.getGenreCollection).toHaveBeenCalledTimes(1);
    resolve({ tracks });
    await flushPromises();
    expect(mocks.playFrom).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});

describe("unknown genre", () => {
  it("keeps missing metadata separate from a real genre named Unknown genre", async () => {
    mocks.libraryTracks = [
      ...tracks,
      { ...tracks[0], id: "blank", genres: ["  "] },
      { ...tracks[0], id: "named", genres: ["Unknown genre"] },
      { ...tracks[0], id: "tagged", genres: ["", "Pop"] },
    ];
    mocks.getGenreList.mockResolvedValue([{ name: "Unknown genre", trackCount: 1 }]);
    const wrapper = await setup();
    const cards = wrapper.getComponent(CoverList).props("items") as CoverItem[];
    expect(cards.map((card) => card.title)).toEqual(["Unknown genre", "Unknown genre"]);
    expect(new Set(cards.map((card) => card.id)).size).toBe(2);
    await wrapper.findAll("[data-play]")[1].trigger("click");
    await flushPromises();
    expect(mocks.playFrom.mock.calls[0][0].map((track: Track) => track.id)).toEqual([
      "genre-song",
      "second-song",
      "blank",
    ]);
    expect(mocks.getGenreCollection).not.toHaveBeenCalled();
    wrapper.getComponent(CoverList).vm.$emit("click", cards[1]);
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.name).toBe("unknown-genre");
    expect(wrapper.get("h1").text()).toBe("Unknown genre");
    expect(
      wrapper
        .getComponent({ name: "SongList" })
        .props("items")
        .map((track: Track) => track.id),
    ).toEqual(["genre-song", "second-song", "blank"]);
    await wrapper.vm.$router.replace({ name: "unknown-genre", query: { filter: "song" } });
    await flushPromises();
    expect(wrapper.getComponent({ name: "SongList" }).props("searchQuery")).toBe("song");
    wrapper.unmount();
  });
});

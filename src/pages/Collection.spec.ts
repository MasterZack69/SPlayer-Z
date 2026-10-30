import { shallowMount, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
import type { Collection as CollectionData } from "@/types/collection";
import en from "@/i18n/locales/en-US.json";

vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({ preset: { ignoreMusicGenre: true } }),
}));

const fixture = vi.hoisted(() => ({
  type: "album",
  description: undefined as string | undefined,
  years: [] as number[],
  tracks: undefined as Track[] | undefined,
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { source: "local", type: fixture.type, id: "test" },
    query: {},
    fullPath: "/collection/local/album/test",
  }),
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/services/collection", () => ({
  loadCollection: async (
    _source: string,
    type: CollectionData["type"],
    _id: string,
    options: { onUpdate: (collection: CollectionData) => void },
  ) => {
    options.onUpdate({
      id: "test",
      source: "local",
      type,
      title: "Test Album",
      description: fixture.description,
      artists: [{ name: "Test Artist" }],
      tracks:
        fixture.tracks ??
        fixture.years.map((year, i) => ({
          id: String(i),
          title: "Track",
          source: "local",
          artists: [],
          duration: 1000,
          year,
        })),
    });
  },
}));
vi.mock("@/composables/usePageSearch", () => ({ usePageSearch: () => ref("") }));
vi.mock("@/composables/useCopyText", () => ({ useCopyText: () => ({ copy: vi.fn() }) }));
vi.mock("@/composables/collection/useCollectionSubscribe", () => ({
  useCollectionSubscribe: () => ({ available: ref(false) }),
}));
vi.mock("@/composables/collection/usePlaylistManage", () => ({
  usePlaylistManage: () => ({
    canManage: ref(false),
    editOpen: ref(false),
    deleteOpen: ref(false),
    editTitle: ref(""),
    editDescription: ref(""),
    submitting: ref(false),
    deleting: ref(false),
  }),
}));
vi.mock("@/services/coverTransition", () => ({
  coverTransitionActive: ref(false),
  getCoverPreview: () => undefined,
}));
vi.mock("@/core/player", () => ({ playFrom: vi.fn() }));
vi.mock("@/components/list/SongList.vue", () => ({ default: { template: "<div />" } }));
import Collection from "./Collection.vue";

/** Mount collection headers with real translations and lightweight UI controls. */
const mountPage = async () => {
  const wrapper = shallowMount(Collection, {
    global: {
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      config: { warnHandler: () => {} },
      stubs: {
        SButton: { template: "<button><slot /></button>" },
        SDialog: {
          props: ["open"],
          template: '<div v-if="open" data-description-dialog><slot /></div>',
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
};

beforeEach(() => {
  fixture.type = "album";
  fixture.years = [];
  fixture.tracks = undefined;
  fixture.description = undefined;
});

describe("collection descriptions", () => {
  it("does not show a description placeholder on albums", async () => {
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("Test Album");
    expect(wrapper.text()).toContain("Test Artist");
    expect(wrapper.text()).not.toContain(en.collection.noDescription);
    expect(wrapper.find('[aria-label="' + en.collection.viewIntroduction + '"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });
  it("does not show album descriptions even when supplied by a provider", async () => {
    fixture.description = "An album overview";
    const wrapper = await mountPage();
    expect(wrapper.text()).not.toContain(fixture.description);
    expect(wrapper.find('[aria-label="' + en.collection.viewIntroduction + '"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });
  it("preserves playlist descriptions and their full-text dialog", async () => {
    fixture.type = "playlist";
    fixture.description = "My playlist description";
    const wrapper = await mountPage();
    const button = wrapper.get('[aria-label="' + en.collection.viewIntroduction + '"]');
    expect(button.text()).toBe(fixture.description);
    await button.trigger("click");
    expect(wrapper.get("[data-description-dialog]").text()).toBe(fixture.description);
    wrapper.unmount();
  });
  it("preserves the playlist placeholder while genres stay free of it", async () => {
    fixture.type = "playlist";
    const playlist = await mountPage();
    expect(playlist.text()).toContain(en.collection.noDescription);
    playlist.unmount();
    fixture.type = "genre";
    const genre = await mountPage();
    expect(genre.text()).not.toContain(en.collection.noDescription);
    genre.unmount();
  });
});

it("shows every distinct album year with slash separators", async () => {
  fixture.years = [2024, 1999, 2024];
  const wrapper = await mountPage();
  expect(wrapper.get("[data-album-years]").text()).toBe("1999 / 2024");
  wrapper.unmount();
});

it("plays album discs and tagged track numbers in the same order as the song list", async () => {
  fixture.tracks = [
    {
      id: "bonus",
      source: "local",
      title: "Bonus",
      artists: [],
      duration: 1000,
      disc: 2,
      track: 1,
    },
    { id: "second", source: "local", title: "Second", artists: [], duration: 1000, track: 2 },
    {
      id: "first",
      source: "local",
      title: "First",
      artists: [],
      duration: 1000,
      disc: 1,
      track: 1,
    },
  ];
  const wrapper = await mountPage();
  await wrapper
    .findAll("button")
    .find((button) => button.text().includes(en.common.playAll))!
    .trigger("click");
  const player = await import("@/core/player");
  expect(vi.mocked(player.playFrom).mock.lastCall?.[0].map((track) => track.id)).toEqual([
    "first",
    "second",
    "bonus",
  ]);
  wrapper.unmount();
});

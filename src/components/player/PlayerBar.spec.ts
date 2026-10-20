import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
import { useMediaStore } from "@/stores/media";
import { useDialog } from "@/composables/useDialog";
import SDialogProvider from "@/components/ui/SDialogProvider.vue";
import PlayerBar from "./PlayerBar.vue";
import en from "@/i18n/locales/en-US.json";

const { deleteTracks, purgeDeletedTracks, showError } = vi.hoisted(() => ({
  deleteTracks: vi.fn(),
  purgeDeletedTracks: vi.fn(),
  showError: vi.fn(),
}));
vi.mock("@/stores/library", () => ({ useLibraryStore: () => ({ deleteTracks }) }));
vi.mock("@/core/player", () => ({ purgeDeletedTracks }));
vi.mock("@/composables/useToast", () => ({ toast: { error: showError, success: vi.fn() } }));
vi.mock("@/stores/status", async () => {
  const { defineStore } = await import("pinia");
  return {
    useStatusStore: defineStore("status", { state: () => ({ position: 0, duration: 10000 }) }),
  };
});
vi.mock("@/stores/media", async () => {
  const { defineStore } = await import("pinia");
  return {
    useMediaStore: defineStore("media", { state: () => ({ track: null as Track | null }) }),
  };
});
const settings = reactive({
  appearance: { layoutMode: "default" },
  player: { showProgressTooltip: false },
});
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => settings }));
vi.mock("@/composables/useFavorite", () => ({
  useFavorite: () => ({ isLiked: () => false, isSupported: () => true, toggle: vi.fn() }),
}));
vi.mock("@/composables/useProgressLyric", () => ({ useProgressLyric: () => ({}) }));
vi.mock("@/composables/useDownload", () => ({ useDownload: () => ({ enqueue: vi.fn() }) }));
vi.mock("@/composables/usePlaylistPicker", () => ({
  usePlaylistPicker: () => ({ open: false, tracks: [], mode: "add", openPicker: vi.fn() }),
}));

let wrapper: VueWrapper;
let media: ReturnType<typeof useMediaStore>;
const original: Track = {
  id: "local-1",
  source: "local",
  path: "/music/one.flac",
  title: "First song",
  artists: [],
  duration: 10000,
};

/** Mount the actual menu dispatch and global confirmation queue with lightweight presentation. */
const mountBar = async (layout = "default") => {
  settings.appearance.layoutMode = layout;
  const pinia = createPinia();
  media = useMediaStore(pinia);
  media.track = { ...original };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<div />" } }],
  });
  await router.push("/");
  wrapper = mount(
    defineComponent({
      components: { PlayerBar, SDialogProvider },
      template: "<PlayerBar /><SDialogProvider />",
    }),
    {
      global: {
        plugins: [
          pinia,
          router,
          createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } }),
        ],
        stubs: {
          TrackInfo: { template: '<div><slot name="title-trailing" /></div>' },
          SDropdownMenu: {
            props: ["items"],
            emits: ["select"],
            template:
              '<div><button v-for="item in items.filter(i => i.show !== false)" :key="item.key" :data-action="item.key" @click="$emit(\'select\', item.key)">{{ item.label }}</button></div>',
          },
          SDialog: {
            props: ["open", "title"],
            emits: ["update:open"],
            template:
              '<section v-if="open" role="dialog" @keydown.esc="$emit(\'update:open\', false)"><h2>{{ title }}</h2><slot /><slot name="footer" /></section>',
          },
          SButton: { template: '<button><slot /><slot name="icon" /></button>' },
          SIconSwap: true,
          SSlider: true,
          PlayerControls: true,
          PlayerTimeInfo: true,
          Toolbar: true,
          PlaylistPickerDialog: true,
        },
      },
    },
  );
};

/** Choose a footer action from the rendered confirmation. */
const choose = async (label: string) => {
  const button = wrapper.findAll('[role="dialog"] button').find((b) => b.text() === label);
  expect(button).toBeDefined();
  await button!.trigger("click");
  await flushPromises();
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteTracks.mockResolvedValue({ deleted: 1, failed: 0 });
  purgeDeletedTracks.mockResolvedValue(undefined);
});
afterEach(() => {
  const { dialogs, settle } = useDialog();
  for (const item of dialogs) settle(item.id, false);
  dialogs.splice(0);
  wrapper?.unmount();
});

describe("player-bar file deletion", () => {
  it.each(["default", "floating"])("confirms before deleting in the %s layout", async (layout) => {
    await mountBar(layout);
    await wrapper.get('[data-action="deleteFile"]').trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain('Permanently delete "First song"');
    expect(deleteTracks).not.toHaveBeenCalled();
    await choose("Confirm");
    expect(deleteTracks).toHaveBeenCalledExactlyOnceWith([original.path]);
    expect(purgeDeletedTracks).toHaveBeenCalledExactlyOnceWith([original.id]);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it.each(["Cancel", "Escape"])("does not delete when dismissed with %s", async (action) => {
    await mountBar();
    await wrapper.get('[data-action="deleteFile"]').trigger("click");
    if (action === "Escape") {
      await wrapper.get('[role="dialog"]').trigger("keydown", { key: "Escape" });
      await flushPromises();
    } else await choose(action);
    expect(deleteTracks).not.toHaveBeenCalled();
    expect(purgeDeletedTracks).not.toHaveBeenCalled();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("keeps the originally selected file when the current song changes", async () => {
    await mountBar();
    await wrapper.get('[data-action="deleteFile"]').trigger("click");
    media.track = { ...original, id: "other", path: "/music/other.flac", title: "Other song" };
    await choose("Confirm");
    expect(deleteTracks).toHaveBeenCalledExactlyOnceWith([original.path]);
    expect(purgeDeletedTracks).toHaveBeenCalledExactlyOnceWith([original.id]);
  });

  it("does not purge playback when deletion fails", async () => {
    await mountBar();
    deleteTracks.mockResolvedValue({ deleted: 0, failed: 1 });
    await wrapper.get('[data-action="deleteFile"]').trigger("click");
    await choose("Confirm");
    expect(showError).toHaveBeenCalledOnce();
    expect(purgeDeletedTracks).not.toHaveBeenCalled();
  });

  it("reports errors without an unhandled rejection", async () => {
    await mountBar();
    deleteTracks.mockRejectedValue(new Error("Permission denied"));
    await wrapper.get('[data-action="deleteFile"]').trigger("click");
    await choose("Confirm");
    expect(showError).toHaveBeenCalledWith("Permission denied");
    expect(purgeDeletedTracks).not.toHaveBeenCalled();
  });

  it("does not offer file deletion for streaming or CUE tracks", async () => {
    await mountBar();
    media.track = { ...original, source: "streaming" };
    await flushPromises();
    expect(wrapper.find('[data-action="deleteFile"]').exists()).toBe(false);
    media.track = { ...original, cuePath: "/music/disc.cue" };
    await flushPromises();
    expect(wrapper.find('[data-action="deleteFile"]').exists()).toBe(false);
  });
});

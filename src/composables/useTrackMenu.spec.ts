import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackContext, Track } from "@shared/types/player";
import en from "@/i18n/locales/en-US.json";
import { useTrackMenu, type TrackMenuOptions } from "./useTrackMenu";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  play: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  copy: vi.fn(),
  push: vi.fn(),
  showInExplorer: vi.fn(),
  copyTrackFile: vi.fn(),
  length: { value: 3 },
}));
vi.mock("@/core/player", () => ({ insertToQueue: mocks.insert, playNow: mocks.play }));
vi.mock("@/stores/queue", () => ({ queueLength: mocks.length }));
vi.mock("@/stores/status", () => ({ useStatusStore: () => ({}) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/composables/useCopyText", () => ({ useCopyText: () => ({ copy: mocks.copy }) }));
vi.mock("@/composables/useToast", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const track = ref<Track | null>({
  id: "song",
  source: "local",
  title: "Song",
  artists: [],
  duration: 180000,
});
/** Mount the composable in an i18n-enabled component. */
const setup = (options: TrackMenuOptions = {}) => {
  let menu!: ReturnType<typeof useTrackMenu>;
  const wrapper = mount(
    defineComponent({
      setup() {
        menu = useTrackMenu(track, options);
        return () => h("div");
      },
    }),
    {
      global: {
        plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      },
    },
  );
  return { menu, wrapper };
};
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, {
    api: { system: { showInExplorer: mocks.showInExplorer, copyTrackFile: mocks.copyTrackFile } },
  });
  mocks.length.value = 3;
  track.value = { id: "song", source: "local", title: "Song", artists: [], duration: 180000 };
});

describe("song menu More submenu", () => {
  it("moves local file, edit, and search actions under More while keeping delete at the top level", () => {
    const { menu, wrapper } = setup({ onEditTags: vi.fn() });
    const visible = menu.items.value.filter((item) => item.show !== false);
    const more = visible.find((item) => item.key === "more");
    expect(visible.map((item) => item.key)).toEqual([
      "play",
      "playNext",
      "addToQueue",
      "addToPlaylist",
      "deleteFile",
      "more",
    ]);
    expect(more?.children?.filter((item) => item.show !== false).map((item) => item.key)).toEqual([
      "editTags",
      "showInExplorer",
      "copyFile",
      "copyPath",
      "searchSame",
      "copyTitle",
    ]);
    wrapper.unmount();
  });

  it("retains search but hides local-only actions for server tracks", () => {
    track.value!.source = "streaming";
    const { menu, wrapper } = setup();
    const more = menu.items.value.find((item) => item.key === "more");
    expect(more?.children?.filter((item) => item.show !== false).map((item) => item.key)).toEqual([
      "searchSame",
      "copyTitle",
      "copyId",
    ]);
    wrapper.unmount();
  });

  it("dispatches the moved actions and uses the CUE audio path", async () => {
    track.value = {
      ...track.value!,
      path: "/music/album.cue",
      cuePath: "/music/album.cue",
      cueAudioPath: "/music/album.flac",
    };
    mocks.copyTrackFile.mockResolvedValue(true);
    const { menu, wrapper } = setup();
    await menu.handleSelect("showInExplorer");
    await menu.handleSelect("copyFile");
    await menu.handleSelect("copyPath");
    await menu.handleSelect("searchSame");
    expect(mocks.showInExplorer).toHaveBeenCalledWith("/music/album.flac");
    expect(mocks.copyTrackFile).toHaveBeenCalledWith(track.value);
    expect(mocks.success).toHaveBeenCalledWith("Copied");
    expect(mocks.copy).toHaveBeenCalledWith("/music/album.flac");
    expect(mocks.push).toHaveBeenCalledWith({ path: "/search", query: { q: "Song" } });
    wrapper.unmount();
  });
});

describe("song menu queue actions", () => {
  it.each(["local", "streaming"] as const)(
    "places Add to Queue immediately after Play Next for %s tracks",
    (source) => {
      track.value!.source = source;
      const { menu, wrapper } = setup();
      expect(
        menu.items.value
          .filter((item) => item.show !== false)
          .slice(0, 3)
          .map((item) => item.key),
      ).toEqual(["play", "playNext", "addToQueue"]);
      expect(menu.items.value[2].label).toBe("Add to Queue");
      wrapper.unmount();
    },
  );

  it("appends using the latest queue length and source context without starting playback", async () => {
    const context = ref<PlaybackContext>({ originType: "album", originId: "album" });
    const { menu, wrapper } = setup({ playbackContext: context });
    mocks.length.value = 12;
    context.value = { originType: "genre", originId: "Pop" };
    await menu.handleSelect("addToQueue");
    expect(mocks.insert).toHaveBeenCalledWith(track.value, 12, context.value);
    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Added to queue");
    wrapper.unmount();
  });

  it("retains Play Next's next-position behavior", async () => {
    const { menu, wrapper } = setup();
    await menu.handleSelect("playNext");
    expect(mocks.insert).toHaveBeenCalledWith(track.value, undefined, undefined);
    expect(mocks.success).toHaveBeenCalledWith("Added to play next");
    wrapper.unmount();
  });

  it("hides the new action with other playback actions and ignores a missing track", async () => {
    const { menu, wrapper } = setup({ hidePlayActions: true });
    expect(
      menu.items.value
        .filter((item) => item.show !== false)
        .some((item) => ["play", "playNext", "addToQueue"].includes(item.key)),
    ).toBe(false);
    track.value = null;
    await menu.handleSelect("addToQueue");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStatusStore } from "@/stores/status";
import { useMediaStore } from "@/stores/media";
import FullPlayer from "./index.vue";
import Lyrics from "../Lyrics/index.vue";

vi.mock("@/stores/status", async () => {
  const { defineStore } = await import("pinia");
  return {
    useStatusStore: defineStore("status", {
      state: () => ({
        isPlayerExpanded: false,
        isPlaying: true,
        isLoading: false,
        position: 0,
        duration: 10000,
        repeatMode: "off",
        shuffleMode: "off",
        heartMode: false,
        fmMode: false,
        showLyric: true,
        fullQueueOpen: false,
        trackLoading: false,
        lyricOffsetMs: 0,
        currentTrack: null,
      }),
    }),
  };
});
vi.mock("@/stores/media", async () => {
  const { defineStore } = await import("pinia");
  return {
    useMediaStore: defineStore("media", {
      state: () => ({
        track: { id: "song-1", cover: "thumb.jpg" },
        parsedLyric: [{}],
        lyricLoading: false,
      }),
    }),
  };
});
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({
    reducedMotion: false,
    player: { coverLayout: "normal", coverLyricRatio: 0.5, enableSpectrum: true },
    lyric: { fontSize: 40, translationFontSize: 20, fontWeight: 600, lyricBlendMode: "screen" },
  }),
}));
vi.mock("@/core/player", () => ({ isSeeking: () => false }));
vi.mock("@/services/playback", () => ({ getCurrentTime: () => 1234 }));
vi.mock("@/composables/usePlaybackTime", () => ({
  usePlaybackTime: () => ({ start: vi.fn(), stop: vi.fn() }),
}));
vi.mock("@/composables/useFavorite", () => ({
  useFavorite: () => ({ isLiked: () => false, isSupported: () => true }),
}));
vi.mock("@/composables/usePlaylistPicker", () => ({
  usePlaylistPicker: () => ({ open: false, tracks: [], mode: "add", openPicker: vi.fn() }),
}));
vi.mock("@/composables/useImmersiveMode", () => ({
  useImmersiveMode: () => ({ immersive: false }),
}));
vi.mock("@/composables/useTimeFormat", () => ({ useTimeFormat: () => ({ timeDisplay: "0:01" }) }));
vi.mock("@/composables/useProgressLyric", () => ({
  useProgressLyric: () => ({ snapToNearestLyric: (v: number) => v }),
}));
vi.mock("@/composables/useWindowControls", () => ({
  useWindowControls: () => ({ isFullscreen: false }),
}));
vi.mock("../Lyrics/index.vue", () => ({
  default: {
    name: "Lyrics",
    emits: ["ready", "seek"],
    template: "<div />",
    methods: { setCurrentTime: vi.fn(), resume: vi.fn(), freeze: vi.fn() },
  },
}));
vi.mock("@vueuse/core", async (original) => {
  const real = await original<typeof import("@vueuse/core")>();
  return { ...real, useDocumentVisibility: () => visibility };
});
const visibility = ref("visible");
let wrapper: VueWrapper;
let idle: Map<number, IdleRequestCallback>;
let sequence = 0;

/** Mount the real player lifecycle while keeping unrelated rendering lightweight. */
const mountPlayer = () => {
  const pinia = createPinia();
  wrapper = mount(FullPlayer, {
    attachTo: document.body,
    global: {
      plugins: [
        pinia,
        createI18n({ legacy: false, locale: "en-US", missingWarn: false, fallbackWarn: false }),
      ],
      stubs: {
        transition: false,
        teleport: true,
        PlayerBackground: {
          name: "PlayerBackground",
          props: ["active", "visible"],
          template: '<div class="background" />',
        },
        BottomSpectrum: true,
        IconFavorite: true,
        IconFavoriteOutline: true,
        IconLucideChevronDown: true,
        IconLucideHeartOff: true,
        IconLucideInfinity: true,
        IconLucideListPlus: true,
        IconLucideMaximize: true,
        IconLucideMinimize: true,
        IconLucidePause: true,
        IconLucidePlay: true,
        IconLucideRepeat: true,
        IconLucideRepeat1: true,
        IconLucideShuffle: true,
        IconLucideSkipBack: true,
        IconLucideSkipForward: true,
        IconLucideTextQuote: true,
        IconSpHeartMode: true,
        IconSpPlayOrder: true,
        LyricActions: true,
        PlayerCover: true,
        PlayerData: true,
        PlaylistPickerDialog: true,
        QueuePanel: true,
        SButton: true,
        SIconSwap: true,
        SSlider: true,
        Toolbar: true,
        WindowControls: true,
      },
    },
  });
  return { status: useStatusStore(pinia), media: useMediaStore(pinia) };
};

/** Complete scheduled idle work deterministically without waiting for wall time. */
const runIdle = (): void => {
  const pending = [...idle.values()];
  idle.clear();
  for (const callback of pending) callback({ didTimeout: false, timeRemaining: () => 20 });
};

beforeEach(() => {
  vi.useFakeTimers();
  visibility.value = "visible";
  idle = new Map();
  vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
    idle.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal("cancelIdleCallback", (id: number) => idle.delete(id));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Now Playing initialization", () => {
  it("always uses normal lyric blending even if a legacy preference is present", async () => {
    const { status } = mountPlayer();
    status.isPlayerExpanded = true;
    await nextTick();
    expect(wrapper.get(".lyric-area").attributes("style")).toContain("mix-blend-mode: normal");
  });

  it("starts the background during entry, before lyrics or idle spectrum work", async () => {
    const { status } = mountPlayer();
    status.isPlayerExpanded = true;
    await nextTick();
    expect(wrapper.findComponent({ name: "PlayerBackground" }).props("active")).toBe(true);
    expect(wrapper.findComponent(Lyrics).exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(wrapper.findComponent(Lyrics).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "BottomSpectrum" }).exists()).toBe(false);
    wrapper.findComponent(Lyrics).vm.$emit("ready");
    await nextTick();
    runIdle();
    await nextTick();
    expect(wrapper.findComponent({ name: "BottomSpectrum" }).exists()).toBe(true);
  });

  it("schedules the spectrum when lyric loading completes with no lyrics", async () => {
    const { status, media } = mountPlayer();
    media.parsedLyric = [];
    media.lyricLoading = true;
    status.isPlayerExpanded = true;
    await vi.advanceTimersByTimeAsync(100);
    media.lyricLoading = false;
    await nextTick();
    runIdle();
    await nextTick();
    expect(wrapper.findComponent({ name: "BottomSpectrum" }).exists()).toBe(true);
  });

  it("cancels pending spectrum initialization on close", async () => {
    const { status } = mountPlayer();
    status.isPlayerExpanded = true;
    await vi.advanceTimersByTimeAsync(100);
    wrapper.findComponent(Lyrics).vm.$emit("ready");
    await nextTick();
    expect(idle.size).toBe(1);
    status.isPlayerExpanded = false;
    await nextTick();
    expect(idle.size).toBe(0);
    runIdle();
    await vi.advanceTimersByTimeAsync(100);
    expect(wrapper.findComponent({ name: "PlayerBackground" }).props("active")).toBe(false);
    expect(wrapper.findComponent({ name: "BottomSpectrum" }).exists()).toBe(false);
  });

  it("defers spectrum work while hidden and resumes when visible", async () => {
    const { status } = mountPlayer();
    visibility.value = "hidden";
    status.isPlayerExpanded = true;
    await vi.advanceTimersByTimeAsync(100);
    wrapper.findComponent(Lyrics).vm.$emit("ready");
    await nextTick();
    expect(idle.size).toBe(0);
    visibility.value = "visible";
    await nextTick();
    expect(idle.size).toBe(1);
    runIdle();
    await nextTick();
    expect(wrapper.findComponent({ name: "BottomSpectrum" }).exists()).toBe(true);
  });
});

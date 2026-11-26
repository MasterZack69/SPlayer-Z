import { createPinia, setActivePinia } from "pinia";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricLine } from "@shared/types/lyrics";
import type { AudioQuality, Track } from "@shared/types/player";
import { useMediaStore } from "./media";

const settings = reactive({
  locale: "en-US",
  lyric: {
    detectBackgroundLyrics: true,
    cjkTransform: "s2t",
    autoGenerateWordByWord: false,
    enableExcludeLyrics: false,
  },
});
const mock = vi.hoisted(() => ({ convert: vi.fn() }));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => settings }));
vi.mock("@/services/lyric/loader", () => ({ watchLyricPreference: vi.fn() }));
vi.mock("@/utils/lyric/cjkTransform", () => ({ applyLyricCjkTransform: mock.convert }));

beforeEach(() => {
  setActivePinia(createPinia());
  settings.lyric.cjkTransform = "s2t";
  Object.defineProperty(window, "api", {
    configurable: true,
    value: { nowPlaying: { update: vi.fn() } },
  });
  mock.convert.mockReset();
});

afterEach(() => {
  useMediaStore().resetLyricState();
});

describe("lyric transform cancellation", () => {
  it.each(["clear", "resetLyricState", "replacement"] as const)(
    "ignores a pending conversion after %s",
    async (operation) => {
      let finish!: (lines: LyricLine[]) => void;
      mock.convert.mockReturnValue(
        new Promise<LyricLine[]>((resolve) => {
          finish = resolve;
        }),
      );
      const media = useMediaStore();
      media.setLyric({ source: "external", format: "lrc" }, { content: "[00:01.00]Old" });
      const old = media.parsedLyric;
      if (operation === "replacement") {
        settings.lyric.cjkTransform = "none";
        media.setLyric({ source: "external", format: "lrc" }, { content: "[00:01.00]New" });
      } else media[operation]();
      finish(old);
      await Promise.resolve();
      expect(media.parsedLyric.map((line) => line.words.map((word) => word.word).join(""))).toEqual(
        operation === "replacement" ? ["New"] : [],
      );
    },
  );
});

describe("decoded quality from the audio engine", () => {
  beforeEach(() => {
    mock.convert.mockResolvedValue([]);
    settings.lyric.cjkTransform = "none";
    useMediaStore().resetLyricState();
  });

  const estimate: AudioQuality = {
    sampleRate: 44100,
    channels: 2,
    bitsPerSample: 16,
    bitRate: 128000,
    codec: "mp3",
  };
  const decoded: AudioQuality = {
    sampleRate: 96000,
    channels: 2,
    bitsPerSample: 24,
    bitRate: 2304000,
    codec: "flac",
  };

  /** Builds a local track whose quality was guessed from the library listing. */
  const localTrack = (): Track => ({
    id: "local-1",
    source: "local",
    path: "/music/track01.flac",
    title: "Real Title",
    artists: [{ id: "1", name: "Artist" }],
    duration: 1000,
    quality: estimate,
  });

  it("replaces the list estimate with the engine's decoded quality", () => {
    const media = useMediaStore();
    media.setTrack(localTrack());
    media.enrichTrack({ duration: 1000, quality: decoded });
    expect(media.track?.quality).toEqual(decoded);
  });

  it("keeps the list estimate when the engine reports no quality", () => {
    const media = useMediaStore();
    media.setTrack(localTrack());
    media.enrichTrack({ duration: 1000 });
    expect(media.track?.quality).toEqual(estimate);
  });
});

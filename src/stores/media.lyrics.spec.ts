import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, reactive } from "vue";
import type { AudioQuality, Track, TrackDetail } from "@shared/types/player";
import { useMediaStore } from "./media";

const settings = reactive({
  locale: "en-US",
  lyric: { detectBackgroundLyrics: true, cjkTransform: "none", enableExcludeLyrics: false },
});
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => settings }));
vi.mock("@/services/lyric/loader", () => ({ watchLyricPreference: vi.fn() }));

const content = `<tt xmlns="http://www.w3.org/ns/ttml">
<head><metadata><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
<audio lyricOffset=".369" role="ext-always"/><audio lyricOffset="-.366" role="spatial"/>
</iTunesMetadata></metadata></head>
<body><div><p begin="1s" end="3s">Line text</p></div></body></tt>`;
const source = { source: "external", format: "ttml" } as const;

/**
 * Construct source quality metadata for a particular channel layout.
 * @param channels - Decoded source channel count.
 * @returns Audio quality metadata for the store.
 */
const quality = (channels: number): AudioQuality => ({
  channels,
  sampleRate: 48000,
  bitsPerSample: 24,
  bitRate: 1000000,
  codec: "flac",
});

/**
 * Set the current source metadata and parse its TTML lyrics.
 * @param channels - Optional library-reported channel count.
 * @param decodedChannels - Optional authoritative decoded channel count.
 * @returns Initialized media store.
 */
const load = (channels?: number, decodedChannels?: number) => {
  const media = useMediaStore();
  const track: Track = {
    id: "test",
    source: "local",
    title: "Track",
    artists: [],
    duration: 10000,
    quality: channels == null ? undefined : quality(channels),
  };
  const detail: TrackDetail | undefined =
    decodedChannels == null
      ? undefined
      : {
          quality: quality(decodedChannels),
          externalLyrics: [],
        };
  media.setTrack(track, detail);
  media.setLyric(source, { content });
  return media;
};

describe("TTML playback timing integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    settings.lyric.cjkTransform = "none";
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { nowPlaying: { update: vi.fn() } },
    });
  });

  it.each([
    [undefined, undefined, 1369],
    [2, undefined, 1369],
    [6, undefined, 634],
    [2, 6, 634],
    [6, 2, 1369],
  ])("uses source channels %s / decoded %s for lyric timing", (channels, decoded, expected) => {
    const media = load(channels, decoded);
    expect(media.parsedLyric[0]).toMatchObject({ startTime: expected });
    expect(media.parsedLyric[0].words[0].startTime).toBe(expected);
    expect(window.api.nowPlaying.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lyric: expect.arrayContaining([expect.objectContaining({ startTime: expected })]),
      }),
    );
    media.updateLyricIndex(expected - 1);
    expect(media.lyricIndex).toBe(-1);
    media.updateLyricIndex(expected);
    expect(media.lyricIndex).toBe(0);
  });

  it("reparses original text without accumulating offsets", async () => {
    const media = load(2);
    media.setLyric(source, { content });
    expect(media.parsedLyric[0].startTime).toBe(1369);
    settings.lyric.cjkTransform = "s2t";
    await nextTick();
    expect(media.parsedLyric[0].startTime).toBe(1369);
    expect(media.lyricContent?.content).toBe(content);
  });

  it("does not carry offsets into replacement lyrics or another source layout", () => {
    const media = load(6);
    media.setLyric(source, { content: content.replaceAll('lyricOffset="', 'unused="') });
    expect(media.parsedLyric[0].startTime).toBe(1000);
    media.clear();
    media.setTrack({
      id: "stereo",
      source: "local",
      title: "Stereo",
      artists: [],
      duration: 10000,
    });
    media.setLyric(source, { content });
    expect(media.parsedLyric[0].startTime).toBe(1369);
    media.setLyric(null, null);
    expect(media.parsedLyric).toEqual([]);
  });
});

describe("lyric songwriter metadata", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("retains lyric-file songwriters and clears them on replacement, reset and clear", () => {
    const media = useMediaStore();
    const content = `<tt xmlns="http://www.w3.org/ns/ttml"
      xmlns:itunes="http://music.apple.com/lyric-ttml-internal">
      <head><metadata><itunes:songwriters><itunes:songwriter>Writer</itunes:songwriter></itunes:songwriters></metadata></head>
      <body><div><p begin="1s" end="3s">Lyrics</p></div></body></tt>`;
    media.setLyric(source, { content });
    expect(media.lyricSongwriters).toEqual(["Writer"]);
    media.setLyric({ source: "external", format: "lrc" }, { content: "[00:01.00]Other lyrics" });
    expect(media.lyricSongwriters).toEqual([]);
    media.setLyric(source, { content });
    media.resetLyricState();
    expect(media.lyricSongwriters).toEqual([]);
    media.setLyric(source, { content });
    media.clear();
    expect(media.lyricSongwriters).toEqual([]);
    media.setLyric(source, { content });
    media.setLyric(source, { content: "invalid lyrics" });
    expect(media.lyricSongwriters).toEqual([]);
  });
});

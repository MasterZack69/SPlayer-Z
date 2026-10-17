import { describe, expect, it, vi } from "vitest";
import { normalizeLyricLines, parseLyric } from "lyric-kit";
import { parsePlaybackLyric } from "./parse";

/**
 * Build a small Apple TTML document with synthetic, word-timed lyrics.
 * @param metadata - Contents of the iTunes metadata container.
 * @param body - Optional replacement lyric paragraphs.
 * @returns A complete TTML document.
 */
const ttml = (
  metadata: string,
  body = '<p begin="1s" end="3s" itunes:key="L1"><span begin="1s" end="2s">Hello </span><span begin="2s" end="3s">world</span></p>',
): string => `<tt xmlns="http://www.w3.org/ns/ttml"
  xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
  xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
  xmlns:tts="http://www.w3.org/ns/ttml#styling">
  <head><metadata><itunes:iTunesMetadata>${metadata}</itunes:iTunesMetadata></metadata></head>
  <body><div>${body}</div></body></tt>`;

/**
 * Parse synthetic TTML with optional source channel information.
 * @param metadata - Apple audio offset declarations.
 * @param audioChannels - Source audio channel count, if known.
 * @returns Parsed playback lyrics and metadata.
 */
const parse = (metadata: string, audioChannels?: number) =>
  parsePlaybackLyric({ content: ttml(metadata) }, "ttml", {
    extractMetadata: true,
    audioChannels,
  });

describe("Apple TTML audio offsets", () => {
  it.each([
    ["0.369", 369],
    ["+0.369", 369],
    ["-0.369", -369],
    [" .0005 ", 1],
    ["-.0005", -1],
    ["0", 0],
    ["1", 1000],
  ])("converts signed seconds %s to %i ms for lines and words", (value, offset) => {
    const { lines, metadata } = parse(`<itunes:audio lyricOffset="${value}" role="ext-always"/>`);
    expect(metadata.offset).toBe(offset);
    expect(lines[0]).toMatchObject({
      startTime: 1000 + offset,
      endTime: 3000 + offset,
      words: [
        { word: "Hello ", startTime: 1000 + offset, endTime: 2000 + offset },
        { word: "world", startTime: 2000 + offset, endTime: 3000 + offset },
      ],
    });
  });

  it.each([undefined, 1, 2, 6, 8])(
    "selects the correct variant for %s source channels",
    (channels) => {
      const { metadata } = parse(
        '<itunes:audio lyricOffset="0.369" role="ext-always"/><itunes:audio lyricOffset="0.222" role="spatial"/>',
        channels,
      );
      expect(metadata.offset).toBe(channels != null && channels > 2 ? 222 : 369);
    },
  );

  it("does not apply spatial-only metadata to stereo or unknown audio", () => {
    const audio = '<itunes:audio lyricOffset="-0.366" role="spatial"/>';
    expect(parse(audio).metadata.offset).toBeUndefined();
    expect(parse(audio, 2).lines[0].startTime).toBe(1000);
    expect(parse(audio, 6).lines[0].startTime).toBe(634);
  });

  it("uses common metadata as the multichannel fallback and accepts a missing role", () => {
    expect(parse('<itunes:audio lyricOffset="0.369" role="ext-always"/>', 6).metadata.offset).toBe(
      369,
    );
    expect(parse('<itunes:audio lyricOffset="-.366"/>', 2).metadata.offset).toBe(-366);
    expect(parse('<itunes:audio lyricOffset="-.366"/>', 6).metadata.offset).toBe(-366);
  });

  it("prefers a zero-valued spatial variant without adding common or unscoped offsets", () => {
    const audio =
      '<itunes:audio lyricOffset=".1"/><itunes:audio lyricOffset=".369" role="ext-always"/><itunes:audio lyricOffset="0" role="spatial"/>';
    expect(parse(audio, 6).metadata.offset).toBe(0);
    expect(parse(audio, 2).metadata.offset).toBe(369);
  });

  it.each(["", "bad", "NaN", "Infinity", "1ms", "1e3", "1,5", "9007199254741"])(
    "ignores malformed or unsafe offset %s",
    (value) => {
      const { lines, metadata } = parse(`<itunes:audio lyricOffset="${value}" role="ext-always"/>`);
      expect(metadata.offset).toBeUndefined();
      expect(lines[0].startTime).toBe(1000);
    },
  );

  it("ignores unrelated roles, namespaces and audio nodes outside the metadata head", () => {
    const content = ttml(
      '<itunes:audio lyricOffset=".5" role="unknown"/><audio lyricOffset=".5"/>',
    ).replace("<body>", '<body><itunes:audio lyricOffset=".9"/>');
    expect(parsePlaybackLyric({ content }, "ttml").lines[0].startTime).toBe(1000);
  });

  it("supports the default Apple namespace used by exported TTML files", () => {
    const content = ttml('<itunes:audio lyricOffset=".369"/>')
      .replaceAll("itunes:iTunesMetadata", "iTunesMetadata")
      .replace(
        "<iTunesMetadata>",
        '<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">',
      );
    expect(parsePlaybackLyric({ content }, "ttml").lines[0].startTime).toBe(1369);
  });

  it("clamps negative times for both line-timed and word-timed TTML", () => {
    for (const body of [undefined, '<p begin="1s" end="3s">Line text</p>']) {
      const { lines } = parsePlaybackLyric(
        { content: ttml('<itunes:audio lyricOffset="-2"/>', body) },
        "ttml",
      );
      normalizeLyricLines(lines);
      expect(lines[0]).toMatchObject({ startTime: 0, endTime: 1000 });
      expect(lines[0].words[0].startTime).toBe(0);
      expect(lines[0].words.at(-1)?.endTime).toBe(1000);
    }
  });

  it("shifts background and ruby intervals once without changing their text", () => {
    const body = `<p begin="1s" end="3s"><span begin="1s" end="2s" tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer"><span tts:ruby="text" begin="1s" end="2s">ji</span></span></span><span ttm:role="x-bg" begin="2s" end="3s"><span begin="2s" end="3s">Backing</span></span></p>`;
    const content = ttml('<itunes:audio lyricOffset=".369"/>', body);
    const baseline = parseLyric({ content, format: "ttml" });
    const shifted = parsePlaybackLyric({ content }, "ttml");
    expect(shifted.lines.some((line) => line.isBG)).toBe(true);
    expect(shifted.lines.some((line) => line.words.some((word) => word.ruby?.length))).toBe(true);
    for (const [i, line] of shifted.lines.entries()) {
      expect(line.startTime).toBe(baseline.lines[i].startTime + 369);
      for (const [j, word] of line.words.entries()) {
        expect(word.word).toBe(baseline.lines[i].words[j].word);
        expect(word.startTime).toBe(baseline.lines[i].words[j].startTime + 369);
        for (const [k, ruby] of (word.ruby ?? []).entries()) {
          expect(ruby.startTime).toBe(baseline.lines[i].words[j].ruby![k].startTime + 369);
          expect(ruby.endTime).toBe(baseline.lines[i].words[j].ruby![k].endTime + 369);
        }
      }
    }
  });

  it("aligns auxiliary tracks before applying the offset, preserving source and authors", () => {
    const input = {
      content: ttml(
        '<itunes:audio lyricOffset=".369"/><itunes:songwriters><itunes:songwriter>Writer</itunes:songwriter></itunes:songwriters>',
      ),
      translation: "[00:01.000]Translation",
      romaji: "[00:01.000]Romanization",
    };
    const original = JSON.stringify(input);
    const result = parsePlaybackLyric(input, "ttml", { extractMetadata: true });
    expect(result.lines[0]).toMatchObject({
      startTime: 1369,
      translatedLyric: "Translation",
      romanLyric: "Romanization",
    });
    expect(result.metadata.songwriters).toEqual(["Writer"]);
    expect(JSON.stringify(input)).toBe(original);
    expect(parsePlaybackLyric(input, "ttml", { extractMetadata: true })).toEqual(result);
    expect(parsePlaybackLyric(input, "ttml").metadata).toEqual({});
  });

  it("honors injected DOM parser instances and constructors", () => {
    const input = { content: ttml('<itunes:audio lyricOffset=".369"/>') };
    for (const domParser of [DOMParser, new DOMParser()]) {
      expect(parsePlaybackLyric(input, "ttml", { domParser }).lines[0].startTime).toBe(1369);
    }
  });

  it("preserves line-only timing for ruby text without explicit word times", () => {
    const body =
      '<p begin="1s" end="3s"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer"><span tts:ruby="text">ji</span></span></span></p>';
    const { lines } = parsePlaybackLyric(
      { content: ttml('<itunes:audio lyricOffset=".369"/>', body) },
      "ttml",
    );
    normalizeLyricLines(lines);
    expect(lines[0]).toMatchObject({
      startTime: 1369,
      endTime: 3369,
      words: [{ word: "字", startTime: 1369, endTime: 3369 }],
    });
  });

  it("reads only the main document's offset and parses each XML source once", () => {
    const parser = new DOMParser();
    const parseFromString = vi.fn(parser.parseFromString.bind(parser));
    const result = parsePlaybackLyric(
      {
        content: ttml('<itunes:audio lyricOffset=".369"/>'),
        translation: ttml(
          '<itunes:audio lyricOffset="9"/>',
          '<p begin="1s" end="3s">Translation</p>',
        ),
        translationFormat: "ttml",
      },
      "ttml",
      { domParser: { parseFromString }, applyOffset: true },
    );
    expect(parseFromString).toHaveBeenCalledTimes(2);
    expect(result.lines[0]).toMatchObject({ startTime: 1369, translatedLyric: "Translation" });
    const noOffset = parsePlaybackLyric(
      {
        content: ttml(""),
        translation: ttml(
          '<itunes:audio lyricOffset="9"/>',
          '<p begin="1s" end="3s">Translation</p>',
        ),
        translationFormat: "ttml",
      },
      "ttml",
    );
    expect(noOffset.lines[0].startTime).toBe(1000);
  });
});

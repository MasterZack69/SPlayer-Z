import { detectFormat, parseLyric, type ParseOptions } from "lyric-kit";
import type { LyricFormat, LyricInput, LyricSpan } from "@shared/types/lyrics";

interface PlaybackLyricOptions extends ParseOptions {
  /** Source audio channel count, not the output device's speaker count. */
  audioChannels?: number;
}

const timestamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Recover missing line breaks only when bracket cues describe whole phrases.
 * @param text - LRC text, including optional metadata and enhanced word cues.
 * @returns LRC with unambiguous phrase-sized inline cues on separate lines.
 */
export const normalizeInlineLrc = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((line) => {
      // Angle tags explicitly mark enhanced LRC; never reinterpret their word timing.
      if (/^\s*\[bg:/i.test(line) || /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/.test(line)) return line;
      const tags = [...line.matchAll(timestamp)];
      if (tags.length < 2) return line;
      const chunks = tags.map((tag, index) => ({
        start: tag.index!,
        text: line.slice(tag.index! + tag[0].length, tags[index + 1]?.index).trim(),
        time:
          Number(tag[1]) * 60_000 + Number(tag[2]) * 1000 + Number((tag[3] ?? "0").padEnd(3, "0")),
      }));
      const phrases = chunks.filter((chunk) => chunk.text && !/^[♪♫♬\s]+$/.test(chunk.text));
      // Bracket word timing is syntactically identical: require phrase-sized text AND line-sized gaps.
      if (
        phrases.length < 2 ||
        phrases.filter(
          ({ text }) =>
            text.split(/\s+/).length >= 3 ||
            /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{P}\p{Z}]{8,}$/u.test(text),
        ).length <
          phrases.length * 0.75
      )
        return line;
      const gaps = chunks.slice(1).map((chunk, index) => chunk.time - chunks[index].time);
      if (
        gaps.some((gap) => gap < 0) ||
        gaps.filter((gap) => gap >= 1500).length < gaps.length * 0.75
      )
        return line;
      let result = line.slice(0, chunks[0].start);
      chunks.forEach((chunk, index) => {
        const previous = chunks[index - 1];
        if (result && (index === 0 || previous?.text)) result += "\n";
        result += line.slice(chunk.start, chunks[index + 1]?.start);
      });
      return result;
    })
    .join("\n");

/**
 * Parse playback lyrics, including compact LRC and Apple TTML audio offsets.
 * @param input - Original lyrics and optional translation/romanization tracks.
 * @param format - Main lyric format.
 * @param options - Parser preferences and the source audio channel count.
 * @returns Parsed lyrics with word timing and metadata preserved.
 */
export const parsePlaybackLyric = (
  input: LyricInput,
  format: LyricFormat,
  options: PlaybackLyricOptions = {},
): ReturnType<typeof parseLyric> => {
  /**
   * Normalize only LRC tracks, leaving other lyric formats intact.
   * @param text - Main or auxiliary lyric content.
   * @param trackFormat - Explicit format, otherwise detected from this track.
   * @returns Original text or normalized plain LRC.
   */
  const normalize = (text: string | undefined, trackFormat: LyricFormat | undefined) =>
    text && (trackFormat ?? detectFormat(text)) === "lrc" ? normalizeInlineLrc(text) : text;
  const { audioChannels, ...parserOptions } = options;
  const mainFormat = options.format ?? format;
  let ttmlOffsetMs: number | undefined;
  if (mainFormat === "ttml") {
    const parser =
      typeof options.domParser === "function"
        ? new options.domParser()
        : (options.domParser ?? new DOMParser());
    let mainDocumentRead = false;
    // Inspect the parser's existing document rather than retaining or parsing another XML tree.
    parserOptions.domParser = {
      parseFromString: (text, type) => {
        const doc = parser.parseFromString(text, type);
        if (mainDocumentRead) return doc;
        mainDocumentRead = true;
        const head = Array.from(doc.documentElement?.children ?? []).find(
          (node) => node.localName === "head" && node.namespaceURI === "http://www.w3.org/ns/ttml",
        );
        const itunesNamespace = "http://music.apple.com/lyric-ttml-internal";
        let common: number | undefined;
        let unscoped: number | undefined;
        let spatial: number | undefined;
        for (const metadata of Array.from(head?.getElementsByTagName("*") ?? [])) {
          if (metadata.localName !== "iTunesMetadata" || metadata.namespaceURI !== itunesNamespace)
            continue;
          for (const audio of Array.from(metadata.children)) {
            if (audio.localName !== "audio" || audio.namespaceURI !== itunesNamespace) continue;
            const value = audio.getAttribute("lyricOffset")?.trim();
            if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) continue;
            const seconds = Number(value);
            const milliseconds = Math.sign(seconds) * Math.round(Math.abs(seconds) * 1000);
            if (!Number.isSafeInteger(milliseconds)) continue;
            const role = audio.getAttribute("role")?.trim() ?? "";
            if (role === "spatial") spatial ??= milliseconds;
            else if (role === "ext-always") common ??= milliseconds;
            else if (!role) unscoped ??= milliseconds;
          }
        }
        ttmlOffsetMs =
          audioChannels != null && audioChannels > 2
            ? (spatial ?? common ?? unscoped)
            : (common ?? unscoped);
        return doc;
      },
    };
  }
  const result = parseLyric(
    {
      ...input,
      format: mainFormat,
      content: normalize(input.content, mainFormat)!,
      translation: normalize(input.translation, input.translationFormat),
      romaji: normalize(input.romaji, input.romajiFormat),
    },
    parserOptions,
  );
  if (ttmlOffsetMs != null) {
    const offset = ttmlOffsetMs;
    if (options.extractMetadata) result.metadata.offset = offset;
    /**
     * Shift a timed interval without allowing negative playback positions.
     * @param span - Line, word, or ruby interval in milliseconds.
     */
    const shift = (span: Pick<LyricSpan, "startTime" | "endTime">): void => {
      span.startTime = Math.max(0, span.startTime + offset);
      span.endTime = Math.max(0, span.endTime + offset);
    };
    for (const line of result.lines) {
      const firstWord = line.words[0];
      // Resolve line-only timing before an offset makes the 0/0 sentinel look timed.
      if (line.words.length === 1 && firstWord.startTime === 0 && firstWord.endTime === 0) {
        firstWord.startTime = line.startTime;
        firstWord.endTime = line.endTime;
      }
      shift(line);
      for (const word of line.words) {
        shift(word);
        for (const ruby of word.ruby ?? []) shift(ruby);
      }
    }
  }
  return result;
};

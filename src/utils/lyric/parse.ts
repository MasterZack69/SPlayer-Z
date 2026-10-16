import { detectFormat, parseLyric } from "lyric-kit";
import type { LyricFormat, LyricInput } from "@shared/types/lyrics";

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
 * Parse playback lyrics after recovering collapsed plain-LRC lines.
 * @param input - Original lyrics and optional translation/romanization tracks.
 * @param format - Main lyric format; non-LRC formats pass through unchanged.
 * @param options - The lyric-kit parser options used by playback.
 * @returns Parsed lyrics with word timing and metadata preserved.
 */
export const parsePlaybackLyric = (
  input: LyricInput,
  format: LyricFormat,
  options: Parameters<typeof parseLyric>[1] = {},
): ReturnType<typeof parseLyric> => {
  /**
   * Normalize only LRC tracks, leaving other lyric formats intact.
   * @param text - Main or auxiliary lyric content.
   * @param trackFormat - Explicit format, otherwise detected from this track.
   * @returns Original text or normalized plain LRC.
   */
  const normalize = (text: string | undefined, trackFormat: LyricFormat | undefined) =>
    text && (trackFormat ?? detectFormat(text)) === "lrc" ? normalizeInlineLrc(text) : text;
  return parseLyric(
    {
      ...input,
      format,
      content: normalize(input.content, format)!,
      translation: normalize(input.translation, input.translationFormat),
      romaji: normalize(input.romaji, input.romajiFormat),
    },
    options,
  );
};

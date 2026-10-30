import type { LyricFormat, LyricLine } from "@shared/types/lyrics";

/**
 * Identify LRC backing vocals with distinct word cues, not just a timed sentence.
 * @param line - Parsed lyric line before or after AMLL optimization.
 * @param format - Active lyric source format.
 * @returns Whether the background line should receive the brighter word-timed style.
 */
export const isWordTimedLrcBackground = (
  line: LyricLine,
  format: LyricFormat | null | undefined,
): boolean => {
  if (format !== "lrc" || !line.isBG) return false;
  const words = line.words.filter((word) => word.word.trim() && Number.isFinite(word.startTime));
  return words.length > 1 && words.some((word) => word.startTime !== words[0].startTime);
};

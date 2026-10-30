import { describe, expect, it } from "vitest";
import type { LyricLine } from "@shared/types/lyrics";
import { parsePlaybackLyric } from "./parse";
import { isWordTimedLrcBackground } from "./background";

/** Parse a backing vocal alongside a main line, as the player receives it. */
const background = (content: string): LyricLine => {
  const { lines } = parsePlaybackLyric(
    { content: `[00:01.00]Main vocal\n${content}\n[00:05.00]Next line` },
    "lrc",
  );
  const line = lines.find((line) => line.isBG);
  expect(line).toBeDefined();
  return line!;
};

describe("word-timed LRC background visibility", () => {
  it.each([
    "[bg:[00:01.00]<00:01.00>Backing <00:02.00>vocals<00:03.00>]",
    "[bg:[00:01.00]Backing [00:02.00]vocals[00:03.00]]",
    "[00:01.00]<00:01.00>(Backing <00:02.00>vocals)<00:03.00>",
  ])("recognizes distinct word timing in %s", (content) => {
    const line = background(content);
    expect(isWordTimedLrcBackground(line, "lrc")).toBe(true);
  });

  it("does not brighten sentence-timed background vocals", () => {
    expect(isWordTimedLrcBackground(background("[bg:[00:01.00]Backing vocals]"), "lrc")).toBe(
      false,
    );
  });

  it("does not change main lines or other lyric formats", () => {
    const line = background("[bg:[00:01.00]<00:01.00>Backing <00:02.00>vocals<00:03.00>]");
    expect(isWordTimedLrcBackground({ ...line, isBG: false }, "lrc")).toBe(false);
    expect(isWordTimedLrcBackground(line, "ttml")).toBe(false);
    expect(isWordTimedLrcBackground(line, null)).toBe(false);
  });

  it("does not mistake whitespace or equal-time text fragments for word timing", () => {
    const line = background("[bg:[00:01.00]Backing vocals]");
    expect(isWordTimedLrcBackground({ ...line, words: [] }, "lrc")).toBe(false);
    expect(
      isWordTimedLrcBackground(
        {
          ...line,
          words: [
            { word: "Backing", startTime: 1000, endTime: 3000 },
            { word: "vocals", startTime: 1000, endTime: 3000 },
            { word: " ", startTime: 2000, endTime: 3000 },
          ],
        },
        "lrc",
      ),
    ).toBe(false);
  });
});

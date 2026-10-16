import { describe, expect, it } from "vitest";
import type { LyricLine } from "@shared/types/lyrics";
import {
  observeLyricMarkdown,
  parseLyricMarkdown,
  prepareLyricMarkdown,
  renderLyricMarkdown,
} from "./markdown";

const line: LyricLine = {
  startTime: 1000,
  endTime: 4000,
  words: [
    {
      word: "You're *ita",
      startTime: 1000,
      endTime: 2000,
      romanWord: "first",
      ruby: [{ word: "reading", startTime: 1000, endTime: 2000 }],
    },
    { word: "lic*, I'm in **", startTime: 2000, endTime: 3000 },
    { word: "BOLD**", startTime: 3000, endTime: 4000 },
  ],
  translatedLyric: "**Translation**",
  romanLyric: "*Romanization*",
  isBG: false,
  isDuet: false,
};

describe("safe lyric emphasis", () => {
  it.each([
    ["You're *italic*, I'm in **BOLD**", "You're italic, I'm in BOLD"],
    ["***both***", "both"],
    ["**bold and *italic***", "bold and italic"],
    ["Unmatched *asterisk", "Unmatched *asterisk"],
    ["\\*literal\\*", "*literal*"],
    ['<img src=x onerror="alert(1)"> **safe**', '<img src=x onerror="alert(1)"> safe'],
    ["[link](https://example.com) ![image](x)", "[link](https://example.com) ![image](x)"],
  ])("supports emphasis without interpreting unrelated markup: %s", (source, text) => {
    expect(parseLyricMarkdown(source).text).toBe(text);
  });

  it("keeps every original timed word, ruby, and romanization without mutating input", () => {
    const original = structuredClone(line);
    const display = prepareLyricMarkdown(line, true);
    expect(display.words.map((word) => word.word)).toEqual(["You're ita", "lic, I'm in ", "BOLD"]);
    expect(display.words.map(({ startTime, endTime }) => [startTime, endTime])).toEqual([
      [1000, 2000],
      [2000, 3000],
      [3000, 4000],
    ]);
    expect(display.words[0].ruby).toEqual(line.words[0].ruby);
    expect(display.words[0].romanWord).toBe("first");
    expect(display.translatedLyric).toBe("Translation");
    expect(display.romanLyric).toBe("Romanization");
    expect(line).toEqual(original);
  });

  it("styles text across animated word nodes while retaining nodes and hiding literal HTML", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<span class="animated">You\'re ita</span><span class="animated">lic, I\'m in </span><span class="animated">BOLD</span>';
    const nodes = [...root.children];
    const styles = prepareLyricMarkdown(line, true).inlineStyles.main;
    renderLyricMarkdown(root, styles);
    expect([...root.children]).toEqual(nodes);
    expect([...root.querySelectorAll("em")].map((node) => node.textContent).join("")).toBe(
      "italic",
    );
    expect(root.querySelector("strong")?.textContent).toBe("BOLD");
    const html = root.innerHTML;
    renderLyricMarkdown(root, styles);
    expect(root.innerHTML).toBe(html);
    const malicious = parseLyricMarkdown("<script>alert(1)</script> **bold**");
    root.textContent = malicious.text;
    renderLyricMarkdown(root, malicious.styles);
    expect(root.querySelector("script")).toBeNull();
    expect(root.textContent).toBe("<script>alert(1)</script> bold");
  });

  it("does not count ruby and per-word romanization as base lyric characters", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<span><span class="amll_rubyWord">ruby</span><span class="base">italic</span><span class="amll_romanWord">roman</span></span><span> BOLD</span>';
    renderLyricMarkdown(root, parseLyricMarkdown("*italic* **BOLD**").styles);
    expect(root.querySelector("em")?.textContent).toBe("italic");
    expect(root.querySelector("strong")?.textContent).toBe("BOLD");
    expect(root.querySelector(".amll_rubyWord")?.children).toHaveLength(0);
  });

  it("reapplies formatting after virtualized line rebuilds and disconnects cleanly", async () => {
    const container = document.createElement("div");
    const root = document.createElement("div");
    root.textContent = "italic BOLD";
    container.append(root);
    const stop = observeLyricMarkdown(
      container,
      new Map([[root, parseLyricMarkdown("*italic* **BOLD**").styles]]),
    );
    expect(root.querySelector("strong")?.textContent).toBe("BOLD");
    root.textContent = "italic BOLD";
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.querySelector("em")?.textContent).toBe("italic");
    expect(root.querySelectorAll("strong")).toHaveLength(1);
    stop();
    root.textContent = "italic BOLD";
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.querySelector("strong")).toBeNull();
  });
});

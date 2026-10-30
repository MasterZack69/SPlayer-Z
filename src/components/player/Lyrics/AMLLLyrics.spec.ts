import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricLine } from "@shared/types/lyrics";
import { parsePlaybackLyric } from "@/utils/lyric/parse";
import AMLLLyrics from "./AMLLLyrics.vue";

vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({ lyric: { amllNormalizeSpaces: true } }),
}));
vi.mock("@/stores/status", () => ({ useStatusStore: () => ({ lyricOffsetMs: 0 }) }));
vi.mock("@/services/playback", () => ({ getCurrentTime: () => 1500 }));
vi.mock("./LyricCredit.vue", () => ({ default: { template: "<span />" } }));
vi.mock("@vueuse/core", () => ({ useRafFn: () => ({ resume: vi.fn(), pause: vi.fn() }) }));
vi.mock("@applemusic-like-lyrics/core", () => ({
  LyricPlayer: class extends EventTarget {
    [key: string]: unknown;
    element = document.createElement("div");
    currentLyricGroups: { mainLine: unknown; bgLine?: unknown }[] = [];
    constructor() {
      super();
      for (const method of [
        "setAlignPosition",
        "setAlignAnchor",
        "setWordFadeWidth",
        "setHidePassedLines",
        "setEnableBlur",
        "setEnableSpring",
        "setEnableScale",
        "setAlwaysPostpositionBackground",
        "setLinePosYSpringParams",
        "setLineScaleSpringParams",
        "setOptimizeOptions",
        "addEventListener",
        "removeEventListener",
        "setCurrentTime",
        "update",
        "resume",
        "pause",
        "dispose",
      ])
        this[method] = vi.fn();
    }
    getElement() {
      return this.element;
    }
    getBottomLineElement() {
      return undefined;
    }
    /** Rebuild line elements as AMLL does when lyrics change. */
    setLyricLines(lines: LyricLine[]) {
      this.element.replaceChildren();
      this.currentLyricGroups = [];
      for (const line of lines) {
        const element = document.createElement("div");
        element.className = line.isBG ? "mock_lyricBgLine" : "mock_lyricLine";
        element.append(document.createElement("div"));
        this.element.append(element);
        const view = { getLine: () => line, getElement: () => element };
        const previous = this.currentLyricGroups.at(-1);
        if (line.isBG && previous) previous.bgLine = view;
        else this.currentLyricGroups.push({ mainLine: view });
      }
    }
  },
}));

/** Build enhanced LRC with one lead and one backing vocal. */
const lyrics = () =>
  parsePlaybackLyric(
    {
      content:
        "[00:01.00]Lead vocal\n[bg:[00:01.00]<00:01.00>Backing <00:02.00>vocals<00:03.00>]\n[00:05.00]Next line",
    },
    "lrc",
  ).lines;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0));
    return 1;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("AMLL timed background styling", () => {
  it("tags only timed LRC backing lines and clears tags when the source format changes", async () => {
    const wrapper = mount(AMLLLyrics, { props: { lyricLines: lyrics(), lyricFormat: "lrc" } });
    await flushPromises();
    const background = wrapper.get(".mock_lyricBgLine");
    expect(background.classes()).toContain("lp-word-timed-background");
    expect(wrapper.findAll(".lp-word-timed-background")).toHaveLength(1);
    await wrapper.setProps({ lyricFormat: "ttml" });
    expect(background.classes()).not.toContain("lp-word-timed-background");
    await wrapper.setProps({ lyricFormat: "lrc" });
    expect(background.classes()).toContain("lp-word-timed-background");
    wrapper.unmount();
  });

  it("reapplies styling after a deferred lyric rebuild without brightening plain background lines", async () => {
    const wrapper = mount(AMLLLyrics, { props: { lyricLines: [], lyricFormat: "lrc" } });
    await flushPromises();
    (wrapper.vm as unknown as { freeze: () => void }).freeze();
    await wrapper.setProps({ lyricLines: lyrics() });
    expect(wrapper.find(".lp-word-timed-background").exists()).toBe(false);
    (wrapper.vm as unknown as { resume: () => void }).resume();
    await flushPromises();
    expect(wrapper.find(".lp-word-timed-background").exists()).toBe(true);
    const plain = lyrics().map((line) =>
      line.isBG
        ? {
            ...line,
            words: [{ word: "Backing vocals", startTime: line.startTime, endTime: line.endTime }],
          }
        : line,
    );
    await wrapper.setProps({ lyricLines: plain });
    expect(wrapper.find(".lp-word-timed-background").exists()).toBe(false);
    wrapper.unmount();
  });
});

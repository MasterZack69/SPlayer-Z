import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import Lyrics from "./index.vue";

vi.mock("./LyricCredit.vue", () => ({ default: { template: "<span />" } }));
vi.mock("./AMLLLyrics.vue", () => ({
  default: {
    name: "AMLLLyrics",
    props: ["lyricLines", "lyricFormat", "playing", "initialTime"],
    template: '<div class="amll"><slot name="bottom" /></div>',
  },
}));
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({ lyric: { engine: "physics" } }),
}));

describe("AMLL-only lyric playback", () => {
  it("uses AMLL even when an old saved engine preference is present", () => {
    const wrapper = mount(Lyrics, {
      props: { lyricLines: [], lyricFormat: "lrc", playing: true, initialTime: 4200 },
      slots: { bottom: "Credits" },
    });
    const amll = wrapper.findComponent({ name: "AMLLLyrics" });
    expect(amll.exists()).toBe(true);
    expect(amll.props()).toMatchObject({
      lyricLines: [],
      lyricFormat: "lrc",
      playing: true,
      initialTime: 4200,
    });
    expect(wrapper.text()).toContain("Credits");
    expect(wrapper.find(".lp-root").exists()).toBe(false);
    amll.vm.$emit("seek", 1234);
    expect(wrapper.emitted("seek")).toEqual([[1234]]);
    wrapper.unmount();
  });
});

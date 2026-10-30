import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LyricCredit from "./LyricCredit.vue";
import { openExternal } from "@/utils/url";

const state = reactive({
  lyric: { showCredits: false },
  lyricAuthors: ["creator"],
  lyricSongwriters: ["Song Writer"],
});
vi.mock("@/stores/media", () => ({ useMediaStore: () => state }));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => state }));
vi.mock("@/utils/url", () => ({ openExternal: vi.fn() }));

beforeEach(() => {
  state.lyric.showCredits = false;
  state.lyricAuthors = ["creator"];
  state.lyricSongwriters = ["Song Writer"];
  vi.clearAllMocks();
});

describe("lyric credits", () => {
  it("hides disabled credits, then displays both types reactively", async () => {
    const wrapper = mount(LyricCredit, { global: { mocks: { $t: (key: string) => key } } });
    expect(wrapper.find("div").exists()).toBe(false);
    state.lyric.showCredits = true;
    await nextTick();
    expect(wrapper.text()).toContain("@creator");
    expect(wrapper.text()).toContain("Song Writer");
    expect(wrapper.findAll("a")).toHaveLength(1);
    await wrapper.get("a").trigger("click");
    expect(openExternal).toHaveBeenCalledWith("https://github.com/creator");
    state.lyric.showCredits = false;
    await nextTick();
    expect(wrapper.find("div").exists()).toBe(false);
    wrapper.unmount();
  });

  it("omits missing credit types and clears the footer when neither is present", async () => {
    state.lyric.showCredits = true;
    state.lyricAuthors = [];
    const wrapper = mount(LyricCredit, { global: { mocks: { $t: (key: string) => key } } });
    expect(wrapper.text()).toContain("Song Writer");
    expect(wrapper.find("a").exists()).toBe(false);
    state.lyricSongwriters = [];
    await nextTick();
    expect(wrapper.find("div").exists()).toBe(false);
    state.lyricAuthors = ["creator"];
    await nextTick();
    expect(wrapper.text()).toContain("@creator");
    expect(wrapper.text()).not.toContain("player.songwriterCredit");
    wrapper.unmount();
  });
});

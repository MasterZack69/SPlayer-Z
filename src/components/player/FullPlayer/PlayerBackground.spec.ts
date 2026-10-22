import { mount } from "@vue/test-utils";
import { reactive, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlayerBackground from "./PlayerBackground.vue";
import BackgroundRender from "./BackgroundRender.vue";

vi.mock("./BackgroundRender.vue", () => ({
  default: {
    name: "BackgroundRender",
    props: ["album", "playing"],
    emits: ["ready"],
    template: "<canvas />",
  },
}));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => settings }));
vi.mock("@/stores/media", () => ({ useMediaStore: () => media }));
vi.mock("@/stores/status", () => ({ useStatusStore: () => status }));

const settings = reactive({
  player: {
    playerBgType: "animation",
    playerBgRenderer: "mesh",
    playerBgFreezeOnPause: true,
    playerBgFps: 30,
    playerBgFlowSpeed: 2,
    playerBgRenderScale: 0.5,
  },
});
const media = reactive({ track: { cover: "cover.jpg" }, parsedLyric: [] });
const status = reactive({ isPlayerExpanded: true, isPlaying: true });

beforeEach(() => {
  settings.player.playerBgType = "animation";
  settings.player.playerBgRenderer = "mesh";
  media.track.cover = "cover.jpg";
});

describe("Now Playing background selection", () => {
  it("mounts fluid on entry without ever showing a blurred-cover preview", async () => {
    const wrapper = mount(PlayerBackground, { props: { visible: false, active: false } });
    expect(wrapper.findComponent(BackgroundRender).exists()).toBe(false);
    await wrapper.setProps({ visible: true, active: true });
    const fluid = wrapper.findComponent(BackgroundRender);
    expect(fluid.exists()).toBe(true);
    expect(wrapper.find(".bg-blur-wrap").exists()).toBe(false);
    expect(wrapper.find(".bg-fluid-wrap").classes()).not.toContain("ready");
    fluid.vm.$emit("ready");
    await nextTick();
    expect(wrapper.find(".bg-fluid-wrap").classes()).toContain("ready");
    media.track.cover = "next.jpg";
    await nextTick();
    expect(wrapper.find(".bg-fluid-wrap").classes()).toContain("ready");
    expect(fluid.props("album")).toBe("next.jpg");
    expect(wrapper.find(".bg-blur-wrap").exists()).toBe(false);
    await wrapper.setProps({ visible: false, active: false });
    expect(wrapper.findComponent(BackgroundRender).exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps the blurred-cover renderer available only for the selected blur mode", () => {
    settings.player.playerBgType = "blur";
    const wrapper = mount(PlayerBackground, { props: { visible: true, active: true } });
    expect(wrapper.find(".bg-blur-wrap").exists()).toBe(true);
    expect(wrapper.findComponent(BackgroundRender).exists()).toBe(false);
    wrapper.unmount();
  });

  it("resets readiness when the renderer changes and on reopening", async () => {
    const wrapper = mount(PlayerBackground, { props: { visible: true, active: true } });
    wrapper.findComponent(BackgroundRender).vm.$emit("ready");
    await nextTick();
    settings.player.playerBgRenderer = "isolation";
    await nextTick();
    expect(wrapper.find(".bg-fluid-wrap").classes()).not.toContain("ready");
    await wrapper.setProps({ visible: false, active: false });
    await wrapper.setProps({ visible: true, active: true });
    expect(wrapper.find(".bg-fluid-wrap").classes()).not.toContain("ready");
    expect(wrapper.find(".bg-blur-wrap").exists()).toBe(false);
    wrapper.unmount();
  });
});

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SSlider from "./SSlider.vue";

describe("seek transition glow", () => {
  it("hides the thumb only while glowing and restores normal controls afterward", async () => {
    const wrapper = mount(SSlider, { props: { modelValue: 40, showPopover: false } });
    expect(wrapper.classes()).not.toContain("s-slider--glow");
    expect(wrapper.get(".s-slider-thumb").classes()).toContain("opacity-100");
    await wrapper.setProps({ glow: true });
    expect(wrapper.classes()).toContain("s-slider--glow");
    expect(wrapper.get(".s-slider-thumb").classes()).toContain("opacity-0");
    await wrapper.setProps({ glow: false });
    expect(wrapper.get(".s-slider-thumb").classes()).toContain("opacity-100");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    wrapper.unmount();
  });
});

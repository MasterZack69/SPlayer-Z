import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SImg from "./SImg.vue";

const src = "https://covers.example/album.jpg";

describe("virtualized image loading", () => {
  it("keeps lazy loading and fades for ordinary images", () => {
    const wrapper = mount(SImg, { props: { src } });
    const cover = wrapper.find('img[decoding="async"]');
    expect(cover.attributes("loading")).toBe("lazy");
    expect(cover.classes()).toContain("opacity-0");
    wrapper.unmount();
  });

  it("does not hide recycled queue thumbnails pending another load event", async () => {
    for (let mountIndex = 0; mountIndex < 3; mountIndex++) {
      const wrapper = mount(SImg, { props: { src, loading: "eager", fade: false } });
      const cover = wrapper.find('img[decoding="async"]');
      expect(cover.attributes("loading")).toBe("eager");
      expect(cover.classes()).not.toContain("opacity-0");
      expect(cover.classes()).not.toContain("transition-opacity");
      await cover.trigger("load");
      expect(wrapper.emitted("load")?.[0][0]).toBe(cover.element);
      wrapper.unmount();
    }
  });

  it("retains the existing cover element when unrelated props change", async () => {
    const wrapper = mount(SImg, { props: { src, loading: "eager", fade: false } });
    const cover = wrapper.find('img[decoding="async"]');
    await cover.trigger("load");
    await wrapper.setProps({ alt: "Updated album title" });
    expect(wrapper.find('img[decoding="async"]').element).toBe(cover.element);
    expect(wrapper.find('img[decoding="async"]').attributes("alt")).toBe("Updated album title");
    wrapper.unmount();
  });

  it("shows a placeholder if a queue cover fails", async () => {
    const wrapper = mount(SImg, { props: { src, loading: "eager", fade: false } });
    await wrapper.find('img[decoding="async"]').trigger("error");
    expect(wrapper.findAll("img")).toHaveLength(2);
    wrapper.unmount();
  });
});

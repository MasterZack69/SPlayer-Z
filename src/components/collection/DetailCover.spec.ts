import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import DetailCover from "./DetailCover.vue";
import defaultFallback from "@/assets/images/song.jpg";

afterEach(() => vi.restoreAllMocks());

describe("decoded detail artwork", () => {
  it("keeps the thumbnail until the full cover has decoded", async () => {
    const decoded = Promise.withResolvers<void>();
    vi.spyOn(HTMLImageElement.prototype, "decode").mockReturnValue(decoded.promise);
    const wrapper = mount(DetailCover, { props: { src: "full.jpg", fallback: "thumb.jpg" } });
    expect(wrapper.find('img[src="thumb.jpg"]').exists()).toBe(true);
    void wrapper.get("[data-cover-image]").trigger("load");
    expect(wrapper.get("[data-cover-image]").attributes("style")).toContain("opacity: 0");
    decoded.resolve();
    await flushPromises();
    expect(wrapper.find('img[src="thumb.jpg"]').exists()).toBe(false);
    expect(wrapper.get("[data-cover-image]").attributes("style")).toContain("opacity: 1");
    wrapper.unmount();
  });

  it("ignores a previous track's delayed decode", async () => {
    const decoded = Promise.withResolvers<void>();
    vi.spyOn(HTMLImageElement.prototype, "decode").mockReturnValue(decoded.promise);
    const wrapper = mount(DetailCover, { props: { src: "old.jpg", fallback: "thumb.jpg" } });
    void wrapper.get("[data-cover-image]").trigger("load");
    await wrapper.setProps({ src: "new.jpg" });
    decoded.resolve();
    await flushPromises();
    expect(wrapper.get("[data-cover-image]").attributes("style")).toContain("opacity: 0");
    wrapper.unmount();
  });

  it("ignores an old decode even after returning to the same URL", async () => {
    const decoded = Promise.withResolvers<void>();
    vi.spyOn(HTMLImageElement.prototype, "decode").mockReturnValue(decoded.promise);
    const wrapper = mount(DetailCover, { props: { src: "same.jpg", fallback: "thumb.jpg" } });
    void wrapper.get("[data-cover-image]").trigger("load");
    await wrapper.setProps({ src: "other.jpg" });
    await wrapper.setProps({ src: "same.jpg" });
    decoded.resolve();
    await flushPromises();
    expect(wrapper.get("[data-cover-image]").attributes("style")).toContain("opacity: 0");
    wrapper.unmount();
  });

  it("recovers from a failed full cover and failed thumbnail", async () => {
    const wrapper = mount(DetailCover, {
      props: { src: "bad-full.jpg", fallback: "bad-thumb.jpg" },
    });
    await wrapper.get("[data-cover-image]").trigger("error");
    await wrapper.get('img[src="bad-thumb.jpg"]').trigger("error");
    expect(wrapper.find(`img[src="${defaultFallback}"]`).exists()).toBe(true);
    await wrapper.setProps({ fallback: "new-thumb.jpg" });
    expect(wrapper.find('img[src="new-thumb.jpg"]').exists()).toBe(true);
    wrapper.unmount();
  });
});

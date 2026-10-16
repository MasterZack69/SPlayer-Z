import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SVirtualList, { type SVirtualListExposed } from "./SVirtualList.vue";

describe("virtual queue drop boundaries", () => {
  it("accounts for top padding once and clamps drops outside the first and last rows", () => {
    const wrapper = mount(SVirtualList, {
      props: { items: [1, 2, 3], itemHeight: 72, itemFixed: true, paddingTop: 32 },
      global: { stubs: { SScrollbar: { template: "<div><slot /></div>" } } },
    });
    const list = wrapper.vm as unknown as SVirtualListExposed;
    expect(list.getDropInfoByOffset(-100)).toEqual({ index: 0, position: "top" });
    expect(list.getDropInfoByOffset(20)).toEqual({ index: 0, position: "top" });
    expect(list.getDropInfoByOffset(32 + 72 + 5)).toEqual({ index: 1, position: "top" });
    expect(list.getDropInfoByOffset(32 + 72 + 60)).toEqual({ index: 1, position: "bottom" });
    expect(list.getDropInfoByOffset(900)).toEqual({ index: 2, position: "bottom" });
    wrapper.unmount();
  });
});

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import YearWheel from "./YearWheel.vue";

const items = Array.from({ length: 12 }, (_, index) => ({
  id: String(2024 - index),
  label: String(2024 - index),
}));

/** Mount the real wheel with a deterministic clock.
 * @param reducedMotion - Whether frames should be skipped.
 * @returns A mounted wheel for gesture checks.
 */
const setup = (reducedMotion = false) =>
  mount(YearWheel, {
    props: { items, selected: "2020", label: "Years", reducedMotion },
    attachTo: document.body,
  });

const pendingFrames = new Set<ReturnType<typeof setTimeout>>();
beforeEach(() => {
  pendingFrames.clear();
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const handle = setTimeout(() => {
      pendingFrames.delete(handle);
      callback(Date.now());
    }, 16);
    pendingFrames.add(handle);
    return handle;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: ReturnType<typeof setTimeout>) => {
    pendingFrames.delete(handle);
    clearTimeout(handle);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("year wheel motion", () => {
  it("eases fractional trackpad movement and commits only after the gesture settles", async () => {
    const wrapper = setup();
    const selected = wrapper.get('[data-year="2020"]').element as HTMLButtonElement;
    const before = selected.style.transform;
    await wrapper.trigger("wheel", { deltaY: 40, deltaMode: 0 });
    await vi.advanceTimersByTimeAsync(64);
    expect(selected.style.transform).not.toBe(before);
    expect(wrapper.emitted("select")).toBeUndefined();
    await wrapper.trigger("wheel", { deltaY: 60, deltaMode: 0 });
    await vi.advanceTimersByTimeAsync(1200);
    expect(wrapper.emitted("select")).toEqual([["2019"]]);
    expect(pendingFrames.size).toBe(0);
    expect(selected.style.willChange).toBe("");
    wrapper.unmount();
  });
  it("reverses a gesture smoothly, normalizes line input, and clamps both ends", async () => {
    const wrapper = setup();
    await wrapper.trigger("wheel", { deltaY: 5, deltaMode: 1 });
    await wrapper.trigger("wheel", { deltaY: -5, deltaMode: 1 });
    await vi.advanceTimersByTimeAsync(1200);
    expect(wrapper.emitted("select")).toBeUndefined();
    await wrapper.trigger("wheel", { deltaY: -9999 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["2024"]);
    await wrapper.trigger("wheel", { deltaY: 9999 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["2013"]);
    wrapper.unmount();
  });
  it("supports arrow, page and boundary keys with one tab stop", async () => {
    const wrapper = setup(true);
    expect(wrapper.findAll('[tabindex="0"]')).toHaveLength(1);
    await wrapper.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["2019"]);
    expect(document.activeElement?.getAttribute("data-year")).toBe("2019");
    await wrapper.trigger("keydown", { key: "Home" });
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["2024"]);
    await wrapper.trigger("keydown", { key: "PageDown" });
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["2019"]);
    await wrapper.trigger("keydown", { key: "End" });
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["2013"]);
    expect(vi.getTimerCount()).toBe(0);
    wrapper.unmount();
  });
  it("keeps keyboard focus through long animated jumps", async () => {
    const wrapper = setup();
    await wrapper.trigger("keydown", { key: "End" });
    await vi.advanceTimersByTimeAsync(32);
    const last = wrapper.get('[data-year="2013"]').element as HTMLButtonElement;
    expect(document.activeElement).toBe(last);
    expect(last.hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.activeElement).toBe(last);
    expect(pendingFrames.size).toBe(0);
    wrapper.unmount();
  });
  it("tracks direct selections, history, sorting, and live reduced-motion changes", async () => {
    const wrapper = setup();
    await wrapper.get('[data-year="2019"]').trigger("click");
    expect(wrapper.emitted("select")).toEqual([["2019"]]);
    await wrapper.setProps({ selected: "2019" });
    await wrapper.setProps({ reducedMotion: true });
    expect(vi.getTimerCount()).toBe(0);
    await wrapper.setProps({ items: [...items].reverse() });
    expect(wrapper.get('[data-year="2019"]').attributes("aria-current")).toBe("true");
    expect((wrapper.get('[data-year="2019"]').element as HTMLElement).style.transform).toContain(
      "0px, 0px, 0px",
    );
    await wrapper.setProps({ selected: "2022" });
    expect(wrapper.get('[data-year="2022"]').attributes("tabindex")).toBe("0");
    wrapper.unmount();
  });
  it("cancels pending selection and frames on hiding, replacement, and unmount", async () => {
    const wrapper = setup();
    await wrapper.trigger("wheel", { deltaY: 200 });
    await wrapper.setProps({ items: items.slice(0, 5) });
    await vi.advanceTimersByTimeAsync(1500);
    expect(wrapper.emitted("select")).toBeUndefined();
    await wrapper.trigger("wheel", { deltaY: -100 });
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
    hidden.mockRestore();
    await wrapper.trigger("wheel", { deltaY: -100 });
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("follows pointer drags, suppresses release clicks, and cancels interrupted gestures", async () => {
    const wrapper = setup(true);
    const root = wrapper.element as HTMLElement;
    root.setPointerCapture = vi.fn();
    root.hasPointerCapture = vi.fn().mockReturnValue(false);
    await wrapper.trigger("pointerdown", {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientY: 200,
    });
    await wrapper.trigger("pointermove", { pointerId: 1, clientY: 136 });
    await wrapper.trigger("pointerup", { pointerId: 1, clientY: 136 });
    expect(wrapper.emitted("select")).toEqual([["2019"]]);
    await wrapper.get('[data-year="2018"]').trigger("click", { detail: 1 });
    expect(wrapper.emitted("select")).toHaveLength(1);
    await wrapper.trigger("pointerdown", {
      button: 0,
      isPrimary: true,
      pointerId: 2,
      clientY: 200,
    });
    await wrapper.trigger("pointermove", { pointerId: 2, clientY: 72 });
    await wrapper.trigger("pointercancel", { pointerId: 2 });
    expect(wrapper.emitted("select")).toHaveLength(1);
    expect((wrapper.get('[data-year="2020"]').element as HTMLElement).style.transform).toContain(
      "0px, 0px, 0px",
    );
    await wrapper.get('[data-year="2018"]').trigger("click", { detail: 0 });
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["2018"]);
    wrapper.unmount();
  });
  it("leaves browser zoom and horizontal trackpad gestures alone", async () => {
    const wrapper = setup();
    await wrapper.trigger("wheel", { deltaY: 100, ctrlKey: true });
    await wrapper.trigger("wheel", { deltaY: 20, deltaX: 100 });
    expect(vi.getTimerCount()).toBe(0);
    expect(wrapper.emitted("select")).toBeUndefined();
    wrapper.unmount();
  });
});

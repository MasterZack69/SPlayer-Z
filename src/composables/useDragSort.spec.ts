import { computed, defineComponent, h, shallowRef } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";
import { useDragSort } from "./useDragSort";

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
beforeEach(() => {
  vi.useFakeTimers();
  frames = new Map();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Advance a drag auto-scroll frame without running an endless timer loop. */
const frame = () => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(0));
};

/** Mount drag sorting against a scrollable fixed-row virtual list fixture. */
const setupDrag = () => {
  const onReorder = vi.fn();
  const scroll = document.createElement("div");
  scroll.scrollTop = 100;
  Object.defineProperties(scroll, { scrollHeight: { value: 1000 }, clientHeight: { value: 300 } });
  scroll.getBoundingClientRect = () => new DOMRect(0, 100, 200, 300);
  const list = shallowRef<SVirtualListExposed | null>({
    wrapperRef: scroll,
    scrollRef: scroll,
    contentRef: scroll,
    actualStartIndex: 0,
    scrollTo: (top) => {
      scroll.scrollTop = top;
    },
    scrollToIndex: vi.fn(),
    getScrollTop: () => scroll.scrollTop,
    getItemTop: (index) => index * 50,
    getDropInfoByOffset: (y) => ({
      index: Math.max(0, Math.min(19, Math.floor(y / 50))),
      position: y % 50 < 25 ? "top" : "bottom",
    }),
  });
  let drag!: ReturnType<typeof useDragSort>;
  const wrapper = mount(
    defineComponent({
      setup() {
        drag = useDragSort({ virtualListRef: list, itemCount: computed(() => 20), onReorder });
        return () => h("div");
      },
    }),
  );
  drag.handlePointerDown(
    new MouseEvent("mousedown", { clientX: 50, clientY: 125, cancelable: true }),
    2,
    "Song",
  );
  return { drag, wrapper, scroll, onReorder };
};

describe("queue drag sorting", () => {
  it("moves the source row to the chosen gap and suppresses the release click", () => {
    const { drag, wrapper, onReorder } = setupDrag();
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 290 }));
    expect(drag.dropIndicator).toEqual({ index: 6, position: "top" });
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(onReorder).toHaveBeenCalledWith(2, 5);
    expect(drag.isDragging.value).toBe(false);
    const click = new MouseEvent("click", { cancelable: true });
    drag.guardDragClick(click);
    expect(click.defaultPrevented).toBe(true);
    vi.runOnlyPendingTimers();
    const nextClick = new MouseEvent("click", { cancelable: true });
    drag.guardDragClick(nextClick);
    expect(nextClick.defaultPrevented).toBe(false);
    wrapper.unmount();
  });

  it.each(["blur", "touchcancel", "Escape"])("cancels on %s without reordering", (type) => {
    const { drag, wrapper, onReorder } = setupDrag();
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 290 }));
    window.dispatchEvent(
      type === "Escape" ? new KeyboardEvent("keydown", { key: "Escape" }) : new Event(type),
    );
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(drag.isDragging.value).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("scrolls in either direction and clamps to the actual scroll bounds", () => {
    const { scroll, wrapper } = setupDrag();
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 395 }));
    frame();
    expect(scroll.scrollTop).toBe(112);
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 105 }));
    frame();
    expect(scroll.scrollTop).toBe(100);
    scroll.scrollTop = 0;
    frame();
    expect(scroll.scrollTop).toBe(0);
    scroll.scrollTop = 700;
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 395 }));
    frame();
    expect(scroll.scrollTop).toBe(700);
    wrapper.unmount();
    expect(frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels on resize without committing stale row geometry", () => {
    const { wrapper, onReorder, drag } = setupDrag();
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 395 }));
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(drag.isDragging.value).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(frames.size).toBe(0);
  });

  it("releases drag work when the document becomes hidden", () => {
    const { wrapper, onReorder, drag } = setupDrag();
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 395 }));
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(drag.isDragging.value).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(frames.size).toBe(0);
  });

  it("ignores non-primary mouse buttons", () => {
    const { drag, wrapper, onReorder } = setupDrag();
    drag.cleanupDragState();
    drag.handlePointerDown(new MouseEvent("mousedown", { button: 2 }), 0, "Song");
    expect(drag.isDragging.value).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("removes window listeners and the drag label on unmount", () => {
    const { drag, wrapper, onReorder } = setupDrag();
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 395 }));
    wrapper.unmount();
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(onReorder).not.toHaveBeenCalled();
    expect(drag.dragLabelData.value).toBeNull();
    expect(frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

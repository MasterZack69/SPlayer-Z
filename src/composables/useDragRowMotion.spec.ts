import { shallowRef } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";
import { useDragRowMotion } from "./useDragRowMotion";

let frames: Map<number, FrameRequestCallback>;
let animations: {
  cancel: ReturnType<typeof vi.fn>;
  resolve: () => void;
  finished: Promise<void>;
}[];
let animate: ReturnType<typeof vi.fn>;
let motion: ReturnType<typeof useDragRowMotion>;
let frameId = 0;

beforeEach(() => {
  frames = new Map();
  animations = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  animate = vi.fn(() => {
    let resolve!: () => void;
    const finished = new Promise<void>((done) => {
      resolve = done;
    });
    const animation = { cancel: vi.fn(), resolve, finished };
    animations.push(animation);
    return animation;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
});
afterEach(() => {
  motion?.dispose();
  document.body.replaceChildren();
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
  vi.unstubAllGlobals();
});

/** Paint a queued drag frame without creating a persistent render loop. */
const paint = (): void => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(0));
};

/** Build a fixed-row queue with padding, palette, and thumbnail content. */
const setup = () => {
  const wrapper = document.createElement("div");
  wrapper.style.setProperty("--s-cover", "255 220 190");
  wrapper.getBoundingClientRect = () => new DOMRect(100, 100, 400, 300);
  let scrollTop = 0;
  const rows = Array.from({ length: 6 }, (_, index) => {
    const row = document.createElement("div");
    row.style.setProperty("--s-cover", "255 220 190");
    row.dataset.queueRow = "";
    row.dataset.queueIndex = String(index);
    const image = document.createElement("img");
    image.src = `/cover-${index}.jpg`;
    row.append(image, `Song ${index} · Artist ${index}`);
    row.getBoundingClientRect = () => new DOMRect(108, 136 + index * 72 - scrollTop, 380, 64);
    wrapper.append(row);
    return row;
  });
  document.body.append(wrapper);
  const list = shallowRef<SVirtualListExposed>({
    wrapperRef: wrapper,
    scrollRef: wrapper,
    contentRef: wrapper,
    actualStartIndex: 0,
    scrollTo: vi.fn(),
    scrollToIndex: vi.fn(),
    getDropInfoByOffset: vi.fn(),
    getScrollTop: () => scrollTop,
    getItemTop: (index: number) => 32 + index * 72,
  });
  motion = useDragRowMotion(list);
  motion.start(1, 450, 230);
  return {
    rows,
    wrapper,
    scroll: (top: number) => {
      scrollTop = top;
    },
  };
};

describe("lifted queue row motion", () => {
  it("lifts the complete row at the original grab point without interactive duplicates", () => {
    const { rows } = setup();
    const preview = document.querySelector<HTMLElement>(".queue-drag-preview")!;
    expect(preview.textContent).toContain("Song 1 · Artist 1");
    expect(preview.querySelector("img")?.getAttribute("src")).toBe("/cover-1.jpg");
    expect(preview.style.width).toBe("380px");
    expect(preview.style.transform).toBe("translate3d(108px, 208px, 0)");
    expect(preview.style.getPropertyValue("--s-cover")).toBe("255 220 190");
    expect(preview.getAttribute("aria-hidden")).toBe("true");
    expect(preview.inert).toBe(true);
    expect(rows[1].classList.contains("queue-drag-source")).toBe(true);
  });

  it("coalesces pointer input and slides only neighbours crossed by the lifted row", () => {
    const { rows } = setup();
    motion.move(470, 330, 2);
    motion.move(480, 400, 4);
    expect(frames.size).toBe(1);
    paint();
    expect(document.querySelector<HTMLElement>(".queue-drag-preview")!.style.transform).toBe(
      "translate3d(138px, 378px, 0)",
    );
    expect(rows[0].style.getPropertyValue("translate")).toBe("0 0px");
    for (const index of [2, 3, 4])
      expect(rows[index].style.getPropertyValue("translate")).toBe("0 -72px");
    expect(rows[5].style.getPropertyValue("translate")).toBe("0 0px");
    motion.move(450, 150, 0);
    paint();
    expect(rows[0].style.getPropertyValue("translate")).toBe("0 72px");
    expect(rows[2].style.getPropertyValue("translate")).toBe("0 0px");
    expect(frames.size).toBe(0);
  });

  it("moves the paint-contained virtual wrapper rather than clipping its inner content", () => {
    const { rows } = setup();
    motion.dispose();
    const wrappers = rows.map((row, index) => {
      const virtual = document.createElement("div");
      virtual.dataset.index = String(index);
      virtual.style.contain = "layout paint";
      row.replaceWith(virtual);
      virtual.append(row);
      return virtual;
    });
    motion.start(1, 450, 230);
    motion.move(450, 400, 4);
    paint();
    expect(wrappers[3].style.getPropertyValue("translate")).toBe("0 -72px");
    expect(wrappers[3].style.contain).toBe("layout paint");
    expect(rows[3].style.getPropertyValue("translate")).toBe("");
    motion.dispose();
    expect(wrappers[3].style.getPropertyValue("translate")).toBe("");
  });

  it("lands at the scrolled destination and restores the source after settling", async () => {
    const { rows, scroll } = setup();
    motion.move(470, 360, 4);
    paint();
    scroll(144);
    motion.finish(4);
    expect(animate).toHaveBeenCalledWith(
      [
        { transform: "translate3d(128px, 338px, 0)" },
        { transform: "translate3d(108px, 280px, 0)" },
      ],
      expect.objectContaining({ duration: 180, fill: "forwards" }),
    );
    expect(rows[1].classList.contains("queue-drag-source")).toBe(true);
    expect(rows[2].style.getPropertyValue("translate")).toBe("");
    expect(document.querySelectorAll(".queue-drag-preview")).toHaveLength(1);
    animations[0].resolve();
    await Promise.resolve();
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    expect(rows[1].classList.contains("queue-drag-source")).toBe(false);
    expect(frames.size).toBe(0);
  });

  it("returns to the original slot when cancelled and removes every shifted style", async () => {
    const { rows } = setup();
    motion.move(470, 400, 4);
    paint();
    motion.cancel();
    expect(animate.mock.calls[0][0][1].transform).toBe("translate3d(108px, 208px, 0)");
    expect(rows[4].style.getPropertyValue("translate")).toBe("0 0px");
    animations[0].resolve();
    await Promise.resolve();
    expect(
      rows.every(
        (row) =>
          !row.classList.contains("queue-drag-shifting") &&
          !row.style.getPropertyValue("translate"),
      ),
    ).toBe(true);
  });

  it("does not let an old settling animation remove a new drag", async () => {
    setup();
    motion.finish(2);
    const old = animations[0];
    motion.start(2, 450, 300);
    expect(old.cancel).toHaveBeenCalledOnce();
    old.resolve();
    await Promise.resolve();
    expect(document.querySelectorAll(".queue-drag-preview")).toHaveLength(1);
    expect(document.querySelector(".queue-drag-preview")?.textContent).toContain("Song 2");
  });

  it("releases recycled rows instead of retaining the whole virtual queue", () => {
    const { rows } = setup();
    motion.move(450, 400, 4);
    paint();
    rows[3].remove();
    motion.move(450, 420, 4);
    paint();
    expect(rows[3].style.getPropertyValue("translate")).toBe("");
    expect(rows[3].classList.contains("queue-drag-shifting")).toBe(false);
  });

  it("honours reduced motion while still following the pointer", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { rows } = setup();
    motion.move(450, 400, 4);
    paint();
    motion.finish(4);
    expect(animate).not.toHaveBeenCalled();
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    expect(rows[1].classList.contains("queue-drag-source")).toBe(false);
  });

  it("cleans up a pending frame and settling animation when disposed", () => {
    const { rows } = setup();
    motion.move(450, 400, 4);
    motion.dispose();
    expect(frames.size).toBe(0);
    motion.start(1, 450, 230);
    motion.finish(4);
    motion.dispose();
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    expect(rows.every((row) => !row.classList.contains("queue-drag-source"))).toBe(true);
  });
});

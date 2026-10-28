import Sortable from "sortablejs";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsDragSort } from "./useSettingsDragSort";

vi.mock("sortablejs", () => ({ default: { create: vi.fn() } }));
let options: Sortable.Options;
let finishLanding: () => void;
let destroy: ReturnType<typeof vi.fn>;
let list: HTMLElement;
let row: HTMLElement;
let editor: ReturnType<typeof createSettingsDragSort>;
let onReorder = vi.fn<(event: Sortable.SortableEvent) => void>();

/** Build a drop event for the row after Sortable has provisionally moved it.
 * @param destination - Destination list, including a different sidebar group.
 */
const dropEvent = (destination = list): Sortable.SortableEvent =>
  ({
    item: row,
    from: list,
    to: destination,
    oldIndex: 0,
    newIndex: 1,
    oldDraggableIndex: 0,
    newDraggableIndex: 1,
  }) as Sortable.SortableEvent;

/** Lift the row from its handle with the same sequence as Sortable. */
const start = (): void => {
  row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 25, clientY: 25 }));
  options.onChoose?.({ item: row } as Sortable.SortableEvent);
  options.onStart?.({ item: row } as Sortable.SortableEvent);
};

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn().mockImplementation(
      () =>
        ({
          finished: new Promise<void>((resolve) => (finishLanding = resolve)),
          cancel: vi.fn(),
        }) as unknown as Animation,
    ),
  });
  destroy = vi.fn();
  vi.mocked(Sortable.create).mockImplementation((_element, supplied) => {
    options = supplied!;
    return { destroy } as unknown as Sortable;
  });
  list = document.createElement("div");
  list.innerHTML = '<div data-config-drag-id="first">First</div><div>Second</div>';
  document.body.append(list);
  row = list.firstElementChild as HTMLElement;
  onReorder = vi.fn<(event: Sortable.SortableEvent) => void>();
  editor = createSettingsDragSort(list, { onEnd: onReorder });
});

afterEach(() => {
  editor.destroy();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-reduced-motion");
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
  vi.unstubAllGlobals();
});

describe("settings drag motion", () => {
  it("uses queue styling and tracks the pointer without easing lag", () => {
    start();
    const preview = document.querySelector<HTMLElement>(".queue-drag-preview")!;
    expect(preview.querySelector(".queue-drag-card")?.textContent).toBe("First");
    expect(preview.getAttribute("aria-hidden")).toBe("true");
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 75, clientY: 125 }));
    expect(preview.style.transform).toBe("translate3d(50px, 100px, 0)");
    expect(options.fallbackOnBody).toBe(true);
    expect(options.ghostClass).toBe("queue-drag-source");
  });

  it("returns DOM ownership to Vue before committing, then lands in the new slot", async () => {
    start();
    list.append(row);
    onReorder.mockImplementation(() => {
      expect(list.firstElementChild).toBe(row);
      list.append(row);
    });
    options.onEnd?.(dropEvent());
    await nextTick();
    expect(onReorder).toHaveBeenCalledOnce();
    expect(row.classList.contains("queue-drag-source")).toBe(true);
    expect(document.querySelector(".queue-drag-landing")).not.toBeNull();
    finishLanding();
    await Promise.resolve();
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    expect(row.classList.contains("queue-drag-source")).toBe(false);
  });

  it("cancels Escape without committing or forwarding it to the dialog", async () => {
    start();
    list.append(row);
    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    document.dispatchEvent(escape);
    options.onEnd?.(dropEvent());
    await nextTick();
    expect(escape.defaultPrevented).toBe(true);
    expect(onReorder).not.toHaveBeenCalled();
    expect(list.firstElementChild).toBe(row);
  });

  it("lands on the Vue-created row after transferring across sidebar groups", async () => {
    const destination = document.createElement("div");
    document.body.append(destination);
    start();
    destination.append(row);
    onReorder.mockImplementation(() => {
      row.remove();
      destination.append(row.cloneNode(true));
    });
    options.onEnd?.(dropEvent(destination));
    await nextTick();
    const target = destination.firstElementChild!;
    expect(target.classList.contains("queue-drag-source")).toBe(true);
    finishLanding();
    await Promise.resolve();
    expect(target.classList.contains("queue-drag-source")).toBe(false);
  });

  it("respects reduced motion and releases previews and listeners on close", async () => {
    document.documentElement.setAttribute("data-reduced-motion", "");
    start();
    options.onEnd?.(dropEvent());
    await nextTick();
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    start();
    editor.destroy();
    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    document.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(document.querySelector(".queue-drag-preview")).toBeNull();
    expect(destroy).toHaveBeenCalled();
  });
});

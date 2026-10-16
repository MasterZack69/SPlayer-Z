import type { Ref } from "vue";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";

/**
 * Lift one queue row above clipping masks and animate only mounted neighbours.
 * @param listRef - Virtual list providing scroll geometry and fixed row positions.
 */
export const useDragRowMotion = (listRef: Ref<SVirtualListExposed | null>) => {
  let preview: HTMLDivElement | null = null;
  let source: HTMLElement | null = null;
  let rows = new Set<HTMLElement>();
  let from = -1;
  let destination = -1;
  let pointer = { x: 0, y: 0 };
  let grab = { x: 0, y: 0 };
  let origin = { left: 0, inset: 0, pitch: 0 };
  let frame: number | null = null;
  let landing: Animation | null = null;
  let reducedMotion = false;
  let active = false;

  /** Move the virtual wrapper so its paint containment travels with the row.
   * @param row - Queue content inside a virtual row wrapper.
   */
  const getMotionElement = (row: HTMLElement): HTMLElement =>
    row.closest<HTMLElement>("[data-index]") ?? row;

  /** Restore a row without triggering a second movement after queue commit.
   * @param row - Mounted or recycled row previously owned by this drag.
   */
  const restoreRow = (row: HTMLElement): void => {
    row.classList.remove("queue-drag-source");
    const element = getMotionElement(row);
    element.classList.remove("queue-drag-shifting");
    element.style.removeProperty("translate");
  };

  /** Release the single preview, animation and mounted-row references. */
  const dispose = (): void => {
    active = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    landing?.cancel();
    landing = null;
    preview?.remove();
    preview = null;
    rows.forEach(restoreRow);
    rows.clear();
    if (source) restoreRow(source);
    source = null;
  };

  /** Apply the latest pointer position and slide neighbours into the open slot. */
  const render = (): void => {
    frame = null;
    if (!active || !preview) return;
    preview.style.transform = `translate3d(${pointer.x - grab.x}px, ${pointer.y - grab.y}px, 0)`;
    const mounted = new Set(
      listRef.value?.wrapperRef?.querySelectorAll<HTMLElement>("[data-queue-row]") ?? [],
    );
    for (const row of rows) if (!mounted.has(row)) restoreRow(row);
    rows = mounted;
    for (const row of rows) {
      const index = Number(row.dataset.queueIndex);
      row.classList.toggle("queue-drag-source", index === from);
      if (index === from) source = row;
      const element = getMotionElement(row);
      element.classList.add("queue-drag-shifting");
      let offset = 0;
      if (from < destination && index > from && index <= destination) offset = -origin.pitch;
      if (from > destination && index >= destination && index < from) offset = origin.pitch;
      element.style.setProperty("translate", `0 ${offset}px`);
    }
  };

  /** Coalesce pointer and auto-scroll updates into one paint. */
  const schedule = (): void => {
    if (active && frame === null) frame = requestAnimationFrame(render);
  };

  /**
   * Capture the actual row and preserve the pointer's grab offset.
   * @param index - Queue position being lifted.
   * @param x - Initial viewport pointer X.
   * @param y - Initial viewport pointer Y.
   */
  const start = (index: number, x: number, y: number): void => {
    dispose();
    const list = listRef.value;
    const row = list?.wrapperRef?.querySelector<HTMLElement>(
      `[data-queue-row][data-queue-index="${index}"]`,
    );
    if (!row || !list?.wrapperRef) return;
    source = row;
    from = destination = index;
    const rect = row.getBoundingClientRect();
    const listRect = list.wrapperRef.getBoundingClientRect();
    origin = {
      left: rect.left,
      inset: rect.top - listRect.top - list.getItemTop(index) + list.getScrollTop(),
      pitch: list.getItemTop(index + 1) - list.getItemTop(index),
    };
    pointer = { x, y };
    grab = { x: x - rect.left, y: y - rect.top };
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    preview = document.createElement("div");
    preview.className = "queue-drag-preview";
    preview.setAttribute("aria-hidden", "true");
    preview.inert = true;
    const style = getComputedStyle(row);
    // Teleporting outside Now Playing must retain its cover palette and user font.
    for (const property of [
      "--s-cover",
      "--s-cover-base",
      "--s-surface-bright",
      "--s-on-surface",
      "--s-primary",
      "--s-on-surface-variant",
    ]) {
      preview.style.setProperty(property, style.getPropertyValue(property));
    }
    preview.style.color = style.color;
    preview.style.font = style.font;
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    const lifted = row.cloneNode(true) as HTMLElement;
    lifted.removeAttribute("data-queue-row");
    lifted.removeAttribute("data-queue-index");
    lifted.classList.add("queue-drag-card");
    preview.append(lifted);
    document.body.append(preview);
    active = true;
    render();
  };

  /**
   * Follow the pointer without easing lag and update the previewed insertion slot.
   * @param x - Latest viewport pointer X.
   * @param y - Latest viewport pointer Y.
   * @param target - Queue destination computed by the drag geometry.
   */
  const move = (x: number, y: number, target: number): void => {
    pointer = { x, y };
    destination = target;
    schedule();
  };

  /**
   * Land in the committed slot, or return to the source when cancelled.
   * @param target - Destination index; omitted for cancellation.
   */
  const finish = (target = from): void => {
    if (!active || !preview) return;
    if (frame !== null) cancelAnimationFrame(frame);
    render();
    active = false;
    const list = listRef.value;
    if (!list?.wrapperRef || reducedMotion || document.hidden) {
      dispose();
      return;
    }
    const top =
      list.wrapperRef.getBoundingClientRect().top +
      list.getItemTop(target) -
      list.getScrollTop() +
      origin.inset;
    const element = preview;
    const transform = `translate3d(${origin.left}px, ${top}px, 0)`;
    landing = element.animate([{ transform: element.style.transform }, { transform }], {
      duration: 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards",
    });
    element.classList.add("queue-drag-landing");
    for (const row of rows) {
      // Committed neighbours already occupy their final visual positions.
      if (target !== from) restoreRow(row);
      else getMotionElement(row).style.setProperty("translate", "0 0px");
    }
    source?.classList.add("queue-drag-source");
    const animation = landing;
    void animation.finished.then(
      () => {
        if (landing === animation) dispose();
      },
      () => {},
    );
  };

  /** Cancel an active gesture without interrupting an already settling drop. */
  const cancel = (): void => {
    if (active) finish();
  };

  return { start, move, finish, cancel, dispose };
};

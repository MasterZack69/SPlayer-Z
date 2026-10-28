import Sortable from "sortablejs";
import { nextTick } from "vue";
import "@/styles/queue-drag.css";

/** Give settings lists the queue's lifted card, pointer tracking and settling motion.
 * @param element - List owned by Vue; rows need stable data-config-drag-id values.
 * @param options - Handle, grouping and draft reorder callback.
 */
export const createSettingsDragSort = (element: HTMLElement, options: Sortable.Options) => {
  let preview: HTMLDivElement | null = null;
  let source: HTMLElement | null = null;
  let landing: Animation | null = null;
  let frame: number | null = null;
  let pointer = { x: 0, y: 0 };
  let grab = { x: 0, y: 0 };
  let canceled = false;
  let active = false;
  let scrollParent: HTMLElement | null = element.parentElement;
  while (scrollParent && !/(auto|scroll)/.test(getComputedStyle(scrollParent).overflowY)) {
    scrollParent = scrollParent.parentElement;
  }

  /** Release the lifted card and any source hidden during its landing. */
  const clearPreview = (): void => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    landing?.cancel();
    landing = null;
    preview?.remove();
    preview = null;
    source?.classList.remove("queue-drag-source");
    source = null;
  };

  /** Read the current system or application motion preference. */
  const reducedMotion = (): boolean =>
    document.documentElement.hasAttribute("data-reduced-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Paint once per frame without easing the card behind the pointer. */
  const paint = (): void => {
    frame = null;
    if (preview) {
      preview.style.transform = `translate3d(${pointer.x - grab.x}px, ${pointer.y - grab.y}px, 0)`;
    }
    if (!active || !scrollParent) return;
    const rect = scrollParent.getBoundingClientRect();
    if (pointer.x < rect.left || pointer.x > rect.right) return;
    const amount = pointer.y < rect.top + 40 ? -12 : pointer.y > rect.bottom - 40 ? 12 : 0;
    const previous = scrollParent.scrollTop;
    scrollParent.scrollTop = Math.max(
      0,
      Math.min(previous + amount, scrollParent.scrollHeight - scrollParent.clientHeight),
    );
    if (scrollParent.scrollTop !== previous) frame = requestAnimationFrame(paint);
  };

  /** Track mouse and touch movement while Sortable handles insertion geometry.
   * @param event - Current drag input.
   */
  const follow = (event: MouseEvent | TouchEvent): void => {
    const position = "touches" in event ? event.touches[0] : event;
    if (!position) return;
    pointer = { x: position.clientX, y: position.clientY };
    if (preview && frame === null) frame = requestAnimationFrame(paint);
  };

  /** Remove only the listeners belonging to this gesture. */
  const stopListening = (): void => {
    document.removeEventListener("mousemove", follow);
    document.removeEventListener("touchmove", follow);
    document.removeEventListener("keydown", cancelOnEscape, true);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("resize", cancel);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("touchcancel", cancel);
  };

  /** End the Sortable gesture without committing its provisional DOM order. */
  const cancel = (): void => {
    if (!active) return;
    canceled = true;
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    document.dispatchEvent(new Event("touchend", { bubbles: true }));
  };

  /** Cancel a drag rather than closing the editor beneath it.
   * @param event - Escape received during a gesture.
   */
  const cancelOnEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel();
  };

  /** Release an active drag when the document stops being visible. */
  const onVisibilityChange = (): void => {
    if (document.hidden) cancel();
  };

  element.addEventListener("mousedown", follow, true);
  element.addEventListener("touchstart", follow, { capture: true, passive: true });

  const sortable = Sortable.create(element, {
    ...options,
    animation: reducedMotion() ? 0 : 180,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    forceFallback: true,
    fallbackOnBody: true,
    scroll: false,
    fallbackClass: "settings-drag-fallback",
    ghostClass: "queue-drag-source",
    onChoose: () => clearPreview(),
    onStart: ({ item }) => {
      active = true;
      canceled = false;
      source = item;
      const rect = item.getBoundingClientRect();
      grab = { x: pointer.x - rect.left, y: pointer.y - rect.top };
      preview = document.createElement("div");
      preview.className = "queue-drag-preview";
      preview.setAttribute("aria-hidden", "true");
      preview.inert = true;
      const style = getComputedStyle(item);
      preview.style.font = style.font;
      preview.style.color = style.color;
      preview.style.width = `${rect.width}px`;
      preview.style.height = `${rect.height}px`;
      preview.style.setProperty("--s-surface-bright", style.getPropertyValue("--s-surface-alt"));
      const card = item.cloneNode(true) as HTMLElement;
      card.classList.remove("queue-drag-source", "sortable-chosen");
      card.classList.add("queue-drag-card");
      card.removeAttribute("data-config-drag-id");
      card.style.removeProperty("transform");
      preview.append(card);
      document.body.append(preview);
      paint();
      document.addEventListener("mousemove", follow);
      document.addEventListener("touchmove", follow, { passive: true });
      document.addEventListener("keydown", cancelOnEscape, true);
      window.addEventListener("blur", cancel);
      window.addEventListener("resize", cancel);
      document.addEventListener("visibilitychange", onVisibilityChange);
      document.addEventListener("touchcancel", cancel);
    },
    onEnd: (event) => {
      active = false;
      if (frame !== null) cancelAnimationFrame(frame);
      paint();
      stopListening();
      const { item, from, to, oldIndex } = event;
      const id = item.dataset.configDragId;
      // Let Vue move its keyed rows; never remount an entire editor after a drop.
      item.remove();
      from.insertBefore(item, from.children[oldIndex ?? 0] ?? null);
      if (!canceled) options.onEnd?.call(sortable, event);
      const released = preview;
      void nextTick(() => {
        if (!preview || preview !== released) return;
        const destination = canceled ? from : to;
        const target = [...destination.children].find(
          (row): row is HTMLElement =>
            row instanceof HTMLElement && row.dataset.configDragId === id,
        );
        if (!target || reducedMotion() || document.hidden) {
          clearPreview();
          return;
        }
        const rect = target.getBoundingClientRect();
        source?.classList.remove("queue-drag-source");
        source = target;
        source.classList.add("queue-drag-source");
        preview.classList.add("queue-drag-landing");
        landing = preview.animate(
          [
            { transform: preview.style.transform },
            { transform: `translate3d(${rect.left}px, ${rect.top}px, 0)` },
          ],
          { duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" },
        );
        void landing.finished.then(clearPreview, () => {});
      });
    },
  });

  return {
    /** Cancel pending input and release the list when its dialog closes or unmounts. */
    destroy: (): void => {
      cancel();
      stopListening();
      clearPreview();
      element.removeEventListener("mousedown", follow, true);
      element.removeEventListener("touchstart", follow, true);
      sortable.destroy();
    },
  };
};

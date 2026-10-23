<script setup lang="ts">
export interface YearWheelEntry {
  id: string;
  label: string;
}

const props = defineProps<{
  items: YearWheelEntry[];
  selected: string;
  label: string;
  reducedMotion: boolean;
}>();
const emit = defineEmits<{ select: [id: string] }>();
const root = shallowRef<HTMLElement | null>(null);
let buttons: HTMLButtonElement[] = [];
let position = 0;
let target = 0;
let frame = 0;
let lastFrame = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let dragging = false;
let pointerId: number | undefined;
let startY = 0;
let startPosition = 0;
let previousY = 0;
let previousTime = 0;
let velocity = 0;
let suppressClick = false;

/** Keep the wheel inside the available year range.
 * @param value - Fractional year index.
 * @returns A valid wheel position.
 */
const clamp = (value: number): number => Math.max(0, Math.min(props.items.length - 1, value));

/** Paint only the visible cylinder face without reactive updates on every frame. */
const paint = (): void => {
  buttons.forEach((button, index) => {
    const distance = index - position;
    const outside = Math.abs(distance) > 3.7;
    const hidden = outside && button !== document.activeElement;
    if (button.hidden !== hidden) button.hidden = hidden;
    if (hidden) return;
    if (outside) {
      button.style.opacity = "0";
      button.style.transform = "translate(-50%, -50%) scale(0)";
      return;
    }
    const angle = distance * 0.31;
    const depth = Math.cos(angle);
    button.style.transform = `translate(-50%, -50%) translate3d(${(1 - depth) * 22}px, ${Math.sin(angle) * 300}px, ${(depth - 1) * 160}px) rotateX(${-distance * 12}deg) scale(${1 - Math.min(Math.abs(distance), 3.7) * 0.085})`;
    button.style.opacity = String(Math.max(0.12, 1 - Math.abs(distance) * 0.25));
  });
};

/** Stop scheduled motion and release transient compositor promotion. */
const stop = (): void => {
  cancelAnimationFrame(frame);
  frame = 0;
  lastFrame = 0;
  buttons.forEach((button) => button.style.removeProperty("will-change"));
};

/** Ease toward the moving target using elapsed time, not the display refresh rate.
 * @param time - Animation frame timestamp.
 */
const tick = (time: number): void => {
  const delta = lastFrame ? Math.min(time - lastFrame, 40) : 16;
  lastFrame = time;
  position += (target - position) * (1 - Math.exp(-delta / 65));
  if (Math.abs(target - position) < 0.001) position = target;
  paint();
  if (position === target) stop();
  else frame = requestAnimationFrame(tick);
};

/** Start a finite animation, or position immediately when motion is reduced. */
const animate = (): void => {
  if (props.reducedMotion || document.hidden) {
    stop();
    position = target;
    paint();
    return;
  }
  if (frame) return;
  buttons.forEach((button, index) => {
    if (Math.abs(index - position) < 5 || Math.abs(index - target) < 5)
      button.style.willChange = "transform, opacity";
  });
  frame = requestAnimationFrame(tick);
};

/** Snap to a whole year and update the song pane once per completed gesture. */
const settle = (): void => {
  clearTimeout(settleTimer);
  settleTimer = undefined;
  target = clamp(Math.round(target));
  const entry = props.items[target];
  if (entry && entry.id !== props.selected) emit("select", entry.id);
  animate();
};

/** Choose a year while retaining focus for keyboard navigation.
 * @param index - Requested year index.
 * @param focus - Whether the selected button should receive focus.
 */
const choose = (index: number, focus = false): void => {
  clearTimeout(settleTimer);
  settleTimer = undefined;
  target = clamp(index);
  const entry = props.items[target];
  if (!entry) return;
  if (entry.id !== props.selected) emit("select", entry.id);
  animate();
  if (focus) {
    buttons[target].hidden = false;
    buttons[target].focus({ preventScroll: true });
  }
};

/** Consume vertical wheel input locally, preserving high-resolution trackpad deltas.
 * @param event - Mouse wheel or trackpad gesture.
 */
const onWheel = (event: WheelEvent): void => {
  if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  if (!props.items.length) return;
  event.preventDefault();
  const pixels = event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? 320 : 1);
  target = clamp(target + pixels / 100);
  animate();
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 140);
};

/** Navigate all years without tabbing through the entire collection.
 * @param event - Keyboard navigation event.
 */
const onKeydown = (event: KeyboardEvent): void => {
  const index = Math.round(target);
  const destinations: Record<string, number> = {
    ArrowUp: index - 1,
    ArrowDown: index + 1,
    Home: 0,
    End: props.items.length - 1,
    PageUp: index - 5,
    PageDown: index + 5,
  };
  if (!(event.key in destinations)) return;
  event.preventDefault();
  choose(destinations[event.key], true);
};

/** Begin a possible touch or mouse drag without stealing a normal click.
 * @param event - Primary pointer contact.
 */
const onPointerDown = (event: PointerEvent): void => {
  if (event.button !== 0 || !event.isPrimary || !props.items.length) return;
  clearTimeout(settleTimer);
  settleTimer = undefined;
  pointerId = event.pointerId;
  startY = previousY = event.clientY;
  startPosition = position;
  previousTime = event.timeStamp;
  velocity = 0;
  dragging = false;
  suppressClick = false;
};

/** Follow the pointer directly; release inertia is measured from recent movement.
 * @param event - Active drag movement.
 */
const onPointerMove = (event: PointerEvent): void => {
  if (event.pointerId !== pointerId) return;
  if (!dragging && Math.abs(event.clientY - startY) < 5) return;
  if (!dragging) {
    dragging = true;
    root.value?.setPointerCapture(event.pointerId);
    stop();
  }
  event.preventDefault();
  const elapsed = event.timeStamp - previousTime;
  if (elapsed > 0) velocity = (previousY - event.clientY) / 91 / elapsed;
  previousY = event.clientY;
  previousTime = event.timeStamp;
  position = target = clamp(startPosition + (startY - event.clientY) / 91);
  paint();
};

/** Finish a drag with bounded inertia, or cancel without an accidental selection.
 * @param event - Pointer release, cancellation, or lost capture.
 */
const onPointerEnd = (event: PointerEvent): void => {
  if (event.pointerId !== pointerId) return;
  pointerId = undefined;
  if (!dragging) return;
  dragging = false;
  suppressClick = true;
  if (root.value?.hasPointerCapture(event.pointerId))
    root.value.releasePointerCapture(event.pointerId);
  if (event.type !== "pointerup") {
    target = clamp(props.items.findIndex((entry) => entry.id === props.selected));
    animate();
    return;
  }
  const momentum =
    event.timeStamp - previousTime < 80 ? Math.max(-3, Math.min(3, velocity * 110)) : 0;
  target = clamp(target + (props.reducedMotion ? 0 : momentum));
  settle();
};

/** Ignore the release click from a completed drag, but allow normal button activation.
 * @param index - Clicked year index.
 * @param event - Activation event, including keyboard-generated clicks.
 */
const onClick = (index: number, event: MouseEvent): void => {
  if (suppressClick && event.detail !== 0) {
    suppressClick = false;
    return;
  }
  choose(index);
};

/** Cancel pending input and release capture before the wheel is replaced or hidden. */
const cancelGesture = (): void => {
  clearTimeout(settleTimer);
  settleTimer = undefined;
  const captured = pointerId;
  pointerId = undefined;
  dragging = false;
  if (captured !== undefined && root.value?.hasPointerCapture(captured))
    root.value.releasePointerCapture(captured);
  stop();
};

/** Rebuild the face after filtering or sorting while preserving the selected year. */
const rebuild = (): void => {
  cancelGesture();
  buttons = Array.from(root.value?.querySelectorAll<HTMLButtonElement>("button") ?? []);
  target = position = clamp(props.items.findIndex((entry) => entry.id === props.selected));
  paint();
};

/** Cancel gestures when the surface is hidden; no background animation is retained. */
const onVisibility = (): void => {
  if (!document.hidden) return;
  cancelGesture();
  position = target = clamp(props.items.findIndex((entry) => entry.id === props.selected));
  paint();
};

watch(() => props.items.map((entry) => entry.id).join("|"), rebuild, { flush: "post" });
watch(
  () => props.selected,
  () => {
    const index = props.items.findIndex((entry) => entry.id === props.selected);
    if (index < 0 || index === target) return;
    clearTimeout(settleTimer);
    settleTimer = undefined;
    target = index;
    animate();
  },
  { flush: "post" },
);
watch(
  () => props.reducedMotion,
  () => {
    if (props.reducedMotion) animate();
  },
);
onMounted(() => {
  rebuild();
  document.addEventListener("visibilitychange", onVisibility);
});
onBeforeUnmount(() => {
  cancelGesture();
  buttons = [];
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <div
    ref="root"
    class="year-wheel"
    role="group"
    :aria-label="label"
    data-year-wheel
    @wheel="onWheel"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @lostpointercapture="onPointerEnd"
  >
    <button
      v-for="(entry, index) in items"
      :key="entry.id"
      type="button"
      class="year-wheel-entry"
      :class="{ 'year-wheel-unknown': entry.id === 'unknown' }"
      :aria-current="entry.id === selected ? 'true' : undefined"
      :tabindex="entry.id === selected ? 0 : -1"
      :data-year="entry.id"
      @click="onClick(index, $event)"
    >
      {{ entry.label }}
    </button>
  </div>
</template>

<style scoped>
.year-wheel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  overflow: hidden;
  perspective: 700px;
  touch-action: none;
  user-select: none;
  overscroll-behavior: contain;
  mask-image: linear-gradient(transparent, black 18%, black 82%, transparent);
}
.year-wheel-entry {
  position: absolute;
  top: 50%;
  left: 50%;
  width: max-content;
  max-width: calc(100% - 12px);
  padding: 5px 3px;
  appearance: none;
  border: 0;
  background: transparent;
  color: rgb(var(--s-on-surface));
  font: inherit;
  font-size: clamp(36px, 5.2vw, 76px);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  cursor: pointer;
  backface-visibility: hidden;
  outline-offset: 2px;
}
.year-wheel-entry[aria-current="true"] {
  color: rgb(var(--s-primary));
  font-weight: 750;
}
.year-wheel-entry:hover {
  text-decoration: underline;
  text-underline-offset: 6px;
}
.year-wheel-unknown {
  font-size: clamp(18px, 2.3vw, 32px);
  text-wrap: balance;
}
.year-wheel-entry[hidden] {
  display: none;
}
</style>

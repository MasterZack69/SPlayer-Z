/* eslint-disable vue/one-component-per-file -- Queue tests use lightweight UI fixtures. */
import { defineComponent, h, nextTick, reactive, ref, type PropType } from "vue";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QueuePopover from "./QueuePopover.vue";
import QueuePanel from "../player/FullPlayer/QueuePanel.vue";
import messages from "@/i18n/locales/en-US.json";
import { queue, queueEntries, setQueue } from "@/stores/queue";
import type { Track } from "@shared/types/player";

const actions = vi.hoisted(() => ({
  playAtIndex: vi.fn(),
  moveInQueue: vi.fn(),
  removeFromQueue: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/core/player", () => actions);
vi.mock("localforage", () => ({
  default: { createInstance: () => ({ setItem: async () => null }) },
}));
vi.mock("@/stores/status", () => ({ useStatusStore: () => status }));
vi.mock("@/stores/media", () => ({ useMediaStore: () => ({ clear: vi.fn() }) }));
vi.mock("@/stores/theme", () => ({ useThemeStore: () => ({ coverColor: null }) }));
const status = reactive({ playIndex: 1 });

const VirtualList = defineComponent({
  props: {
    items: { type: Array as PropType<Track[]>, required: true },
    itemHeight: { type: Number, required: true },
    paddingTop: { type: Number, default: 0 },
    getItemKey: {
      type: Function as PropType<(item: Track, index: number) => number>,
      required: true,
    },
  },
  setup(props, { expose, slots }) {
    const wrapperRef = ref<HTMLElement | null>(null);
    expose({
      wrapperRef,
      getScrollTop: () => 0,
      scrollToIndex: vi.fn(),
      getDropInfoByOffset: (offset: number) => {
        const y = Math.max(0, offset - (props.paddingTop || 0));
        return {
          index: Math.min(props.items.length - 1, Math.floor(y / props.itemHeight)),
          position: y % props.itemHeight < props.itemHeight / 2 ? "top" : "bottom",
        };
      },
    });
    return () =>
      h(
        "div",
        { ref: wrapperRef },
        props.items.map((item: Track, index: number) =>
          h("div", { key: props.getItemKey(item, index) }, slots.default?.({ item, index })),
        ),
      );
  },
});
const Button = defineComponent({
  setup(_, { slots }) {
    return () => h("button", [slots.default?.(), slots.icon?.()]);
  },
});
const Image = defineComponent({ props: { src: String }, setup: () => () => h("div") });
const Dialog = defineComponent({ setup: () => () => null });
const Icon = defineComponent({ setup: () => () => h("svg") });

/** Mount either queue view with its actual shared actions and drag composable. */
const setupQueue = (component: typeof QueuePopover | typeof QueuePanel) =>
  mount(component, {
    attachTo: document.body,
    global: {
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": messages } })],
      components: { SVirtualList: VirtualList, SButton: Button, SImg: Image, SDialog: Dialog },
      stubs: {
        IconLucideLocate: Icon,
        IconLucideTrash2: Icon,
        IconLucideX: Icon,
        IconLucideListMusic: Icon,
        IconLucideGripVertical: Icon,
        transition: false,
      },
    },
  });
beforeEach(() => {
  setQueue(
    ["First", "Second", "Third"].map((title) => ({
      id: title,
      title,
      source: "local",
      duration: 1000,
      artists: [],
    })),
  );
  status.playIndex = 1;
});

describe.each([
  ["popover", QueuePopover],
  ["Now Playing", QueuePanel],
] as const)("%s queue", (_, component) => {
  it("labels the queue correctly and reorders from the handle without playing or closing", async () => {
    const wrapper = setupQueue(component);
    expect(wrapper.text()).toContain("Queue");
    expect(wrapper.text()).not.toContain("Playlist");
    const handles = wrapper.findAll(".queue-drag-handle");
    expect(handles).toHaveLength(3);
    expect(handles[0].attributes("aria-label")).toBe("Move First in queue");
    await handles[0].trigger("mousedown", { clientX: 20, clientY: 20, button: 0 });
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 20, clientY: component === QueuePanel ? 240 : 160 }),
    );
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(actions.moveInQueue).toHaveBeenCalledWith(0, 2);
    await handles[0].trigger("click");
    expect(actions.playAtIndex).not.toHaveBeenCalled();
    expect(wrapper.emitted("close")).toBeUndefined();
    wrapper.unmount();
  });

  it("supports arrow-key ordering and keeps ordinary row clicks working", async () => {
    const wrapper = setupQueue(component);
    const handles = wrapper.findAll(".queue-drag-handle");
    await handles[1].trigger("keydown", { key: "ArrowUp" });
    expect(actions.moveInQueue).toHaveBeenCalledWith(1, 0);
    await handles[0].trigger("keydown", { key: "ArrowUp" });
    expect(actions.moveInQueue).toHaveBeenCalledTimes(1);
    await handles[1].trigger("keydown", { key: "ArrowDown" });
    expect(actions.moveInQueue).toHaveBeenLastCalledWith(1, 2);
    await wrapper.findAll(".group")[1].trigger("click");
    expect(actions.playAtIndex).toHaveBeenCalledWith(1);
    wrapper.unmount();
  });

  it("cancels a drag if queue entries change before the drop", async () => {
    const wrapper = setupQueue(component);
    await wrapper.find(".queue-drag-handle").trigger("mousedown", { clientX: 20, clientY: 20 });
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 20, clientY: component === QueuePanel ? 240 : 160 }),
    );
    queueEntries.value = [...queueEntries.value].reverse();
    await nextTick();
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(actions.moveInQueue).not.toHaveBeenCalled();
    expect(queue.value[0].title).toBe("Third");
    wrapper.unmount();
  });

  it("keeps duplicate track IDs as distinct, stable queue rows", async () => {
    setQueue([queue.value[0], queue.value[0], queue.value[1]]);
    const wrapper = setupQueue(component);
    const list = wrapper.findComponent(VirtualList);
    const key = list.props("getItemKey");
    const first = key(queue.value[0], 0),
      second = key(queue.value[1], 1);
    expect(first).not.toBe(second);
    queueEntries.value = [queueEntries.value[1], queueEntries.value[0], queueEntries.value[2]];
    await nextTick();
    expect(key(queue.value[0], 0)).toBe(second);
    expect(key(queue.value[1], 1)).toBe(first);
    wrapper.unmount();
  });
});

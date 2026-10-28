import { reactive } from "vue";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import english from "@/i18n/locales/en-US.json";
import { SONG_LIST_COLUMNS, type SongListColumn } from "@/utils/songListColumns";
import SongListColumnsConfig from "./SongListColumnsConfig.vue";

const settings = reactive({
  reducedMotion: false,
  appearance: {
    songListColumnOrder: [...SONG_LIST_COLUMNS],
    songListHiddenColumns: [] as SongListColumn[],
  },
});
const sortable = vi.hoisted(() => ({ create: vi.fn(() => ({ destroy: vi.fn() })) }));
vi.mock("sortablejs", () => ({ default: sortable }));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => settings }));

const Dialog = {
  props: { open: Boolean },
  emits: ["update:open"],
  template: `<div v-if="open"><slot /><slot name="footer" :close="() => $emit('update:open', false)" /></div>`,
};
const Switch = {
  props: { modelValue: Boolean, disabled: Boolean },
  emits: ["update:modelValue"],
  template: `<button role="switch" :aria-checked="modelValue" :disabled="disabled" @click="$emit('update:modelValue', !modelValue)" />`,
};

/** Render the actual editor with small dialog and switch stand-ins. */
const mountEditor = () =>
  mount(SongListColumnsConfig, {
    global: {
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": english } })],
      stubs: {
        SButton: { template: "<button><slot /></button>" },
        SDialog: Dialog,
        SSwitch: Switch,
        IconLucideGripVertical: true,
      },
    },
  });

beforeEach(() => {
  settings.appearance.songListColumnOrder = [...SONG_LIST_COLUMNS];
  settings.appearance.songListHiddenColumns = [];
});

describe("song-list column editor", () => {
  it("supports keyboard reordering and visibility without saving until confirmed", async () => {
    const wrapper = mountEditor();
    await wrapper.get("button").trigger("click");
    const title = wrapper.get('[data-column-key="title"]');
    expect(title.get('[role="switch"]').attributes("disabled")).toBeDefined();
    await wrapper.get('[data-column-key="album"] [role="switch"]').trigger("click");
    await wrapper.get('[data-column-handle="year"]').trigger("keydown", { key: "ArrowUp" });
    expect(settings.appearance.songListHiddenColumns).toEqual([]);
    const confirm = wrapper.findAll("button").find((button) => button.text() === "Confirm")!;
    await confirm.trigger("click");
    expect(settings.appearance.songListHiddenColumns).toEqual(["album"]);
    expect(settings.appearance.songListColumnOrder.indexOf("year")).toBe(3);
    wrapper.unmount();
  });

  it("discards canceled edits and resets only the draft", async () => {
    settings.appearance.songListHiddenColumns = ["size"];
    const wrapper = mountEditor();
    await wrapper.get("button").trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Reset")!
      .trigger("click");
    expect(settings.appearance.songListHiddenColumns).toEqual(["size"]);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Cancel")!
      .trigger("click");
    await wrapper.get("button").trigger("click");
    expect(wrapper.get('[data-column-key="size"] [role="switch"]').attributes("aria-checked")).toBe(
      "false",
    );
    wrapper.unmount();
  });
});

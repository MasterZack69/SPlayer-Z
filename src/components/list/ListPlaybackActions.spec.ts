import { mount, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackContext, Track } from "@shared/types/player";
import en from "@/i18n/locales/en-US.json";
import ListPlaybackActions from "./ListPlaybackActions.vue";

const playback = vi.hoisted(() => ({ playFrom: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/player", () => playback);
const tracks: Track[] = [
  { id: "one", source: "local", title: "One", artists: [], duration: 1000 },
  { id: "two", source: "streaming", title: "Two", artists: [], duration: 2000 },
];
const context: PlaybackContext = { originType: "page", originId: "year:2024", originName: "2024" };

/** Render playback controls with an inspectable dropdown boundary. */
const setup = (items = tracks) =>
  mount(ListPlaybackActions, {
    props: { items, context },
    global: {
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      stubs: {
        SButton: {
          props: ["disabled"],
          template: '<button :disabled="disabled"><slot /></button>',
        },
        SDropdownMenu: {
          name: "SDropdownMenu",
          props: ["items"],
          emits: ["select"],
          template:
            '<div><slot name="trigger" /><button v-for="item in items" :key="item.key" :disabled="item.disabled" @click="$emit(\'select\', item.key)">{{ item.label }}</button></div>',
        },
      },
    },
  });

beforeEach(() => vi.clearAllMocks());
describe("list playback actions", () => {
  it("plays the current list without forcing a playback mode", async () => {
    const wrapper = setup();
    await wrapper.findAll("button")[0].trigger("click");
    expect(playback.playFrom).toHaveBeenCalledWith(tracks, { context });
    wrapper.unmount();
  });

  it("shuffles the current scope and reacts to year/context changes", async () => {
    const wrapper = setup();
    await wrapper.findAll("button")[2].trigger("click");
    expect(playback.playFrom).toHaveBeenLastCalledWith(tracks, { shuffle: true, context });
    const unknownContext = { ...context, originId: "year:unknown", originName: "Unknown year" };
    await wrapper.setProps({ items: [tracks[0]], context: unknownContext });
    await wrapper.findAll("button")[2].trigger("click");
    expect(playback.playFrom).toHaveBeenLastCalledWith([tracks[0]], {
      shuffle: true,
      context: unknownContext,
    });
    wrapper.unmount();
  });

  it("disables both controls and guards stale menu events when empty", async () => {
    const wrapper = setup([]);
    expect(
      wrapper.findAll("button").every((button) => button.attributes("disabled") !== undefined),
    ).toBe(true);
    wrapper.getComponent({ name: "SDropdownMenu" }).vm.$emit("select", "shuffleAll");
    await flushPromises();
    expect(playback.playFrom).not.toHaveBeenCalled();
    await wrapper.setProps({ items: tracks });
    expect(
      wrapper.findAll("button").every((button) => button.attributes("disabled") === undefined),
    ).toBe(true);
    wrapper.unmount();
  });
});

import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/locales/en-US.json";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(() => true), collapse: vi.fn() }));
vi.mock("@/stores/status", () => ({
  useStatusStore: () => ({ isPlayerExpanded: true, position: 0, duration: 1, volume: 0.5 }),
}));
vi.mock("@/stores/media", () => ({
  useMediaStore: () => ({
    track: {
      id: "track",
      title: "Song",
      source: "streaming",
      serverId: "server-a",
      artists: [{ id: "artist-a", name: "Artist A" }, { name: "Unknown ID" }],
    },
  }),
}));
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({ preset: { hideExplicitTag: true } }),
}));
vi.mock("@/composables/useFavorite", () => ({
  useFavorite: () => ({ isSupported: () => true, isLiked: () => false }),
}));
vi.mock("@/composables/useTimeFormat", () => ({
  useTimeFormat: () => ({ timeDisplay: ["0:00", "0:01"], toggleTimeFormat: vi.fn() }),
}));
vi.mock("@/composables/useProgressLyric", () => ({
  useProgressLyric: () => ({ snapToNearestLyric: (v: number) => v }),
}));
vi.mock("@/core/player", () => ({}));
vi.mock("@/services/playerTransition", () => ({ setPlayerExpanded: mocks.collapse }));
vi.mock("@/utils/navigate", () => ({
  canNavigateToResource: (target: { id?: string }) => Boolean(target.id),
  navigateToResource: mocks.navigate,
}));
import AmControls from "./AmControls.vue";

describe("AM artist navigation", () => {
  it("keeps track details separate and opens only navigable artists with their server identity", async () => {
    const wrapper = mount(AmControls, {
      global: {
        plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
        stubs: {
          SPopover: { template: '<div><slot name="trigger"/><slot /></div>' },
          SMarquee: { template: "<span><slot /></span>" },
          SButton: true,
          SSlider: true,
          PlayerData: true,
        },
      },
    });
    const details = wrapper.get('button[aria-label="Track details"]');
    expect(details.text()).toContain("Song");
    expect(details.text()).not.toContain("Artist A");
    const artist = wrapper.findAll("button").find((button) => button.text() === "Artist A");
    expect(artist).toBeDefined();
    expect(wrapper.findAll("button").some((button) => button.text() === "Unknown ID")).toBe(false);
    await artist!.trigger("click");
    expect(mocks.navigate).toHaveBeenCalledWith({
      type: "artist",
      source: "streaming",
      serverId: "server-a",
      id: "artist-a",
      name: "Artist A",
    });
    expect(mocks.collapse).toHaveBeenCalledWith(false);
    wrapper.unmount();
  });
});

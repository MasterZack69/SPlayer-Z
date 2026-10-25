import { shallowMount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { expect, it, vi } from "vitest";
import en from "@/i18n/locales/en-US.json";

const fixture = await vi.hoisted(async () => {
  const { reactive } = await import("vue");
  return reactive({ ignoreMusicGenre: true });
});
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({
    preset: fixture,
    lyric: { lyricSourcePreference: "auto" },
    player: { showPlaybackSource: false },
  }),
}));
vi.mock("@/stores/media", () => ({
  useMediaStore: () => ({
    track: {
      id: "one",
      title: "Track",
      source: "local",
      artists: [],
      genres: ["Music", "music", "MUSIC", "mUsIc", "Dubstep", "Electronic Music", "Podcast"],
    },
  }),
}));
vi.mock("@/stores/status", () => ({ useStatusStore: () => ({}) }));
vi.mock("@/services/playerTransition", () => ({ setPlayerExpanded: vi.fn() }));
vi.mock("@/utils/navigate", () => ({
  canNavigateToResource: () => true,
  navigateToResource: vi.fn(),
}));
import PlayerData from "./PlayerData.vue";

it("filters every Music capitalization in Now Playing and restores original labels on opt-out", async () => {
  const wrapper = shallowMount(PlayerData, {
    global: {
      stubs: {
        SMarquee: { template: "<div><slot /></div>" },
        SPopselect: true,
        IconLucideDisc3: true,
        IconLucideGuitar: true,
        IconLucideLink2: true,
        IconLucideMic: true,
        IconSpLossless: true,
      },
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
    },
  });
  expect(wrapper.text()).toContain("Electronic Music");
  expect(wrapper.text()).toContain("Podcast");
  expect(wrapper.text()).not.toContain("MUSIC");
  expect(wrapper.text()).not.toContain("mUsIc");
  fixture.ignoreMusicGenre = false;
  await wrapper.vm.$nextTick();
  expect(wrapper.text()).toContain("MUSIC");
  expect(wrapper.text()).toContain("mUsIc");
  wrapper.unmount();
});

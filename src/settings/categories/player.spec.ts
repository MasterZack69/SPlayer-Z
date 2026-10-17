import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSystemConfig } from "@shared/defaults/settings";
import { deepMerge } from "../../../electron/main/store/utils";
import playerCategory from "./player";

const player = vi.hoisted(() => ({ preloadNextTrack: false, transitionMode: "none" }));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => ({ player }) }));
vi.mock("@/components/settings/custom/DeviceSelector.vue", () => ({ default: {} }));
vi.mock("~icons/lucide/play", () => ({ default: {} }));
vi.mock("@/core/player", () => ({ getActiveDeviceId: vi.fn() }));
vi.mock("@/services/deviceVolume", () => ({ setDeviceVolume: vi.fn() }));
vi.mock("@/stores/status", () => ({ useStatusStore: () => ({ volume: 1 }) }));

const items = playerCategory.sections!.flatMap((section) => section.items);
describe("local preloading and screen-awake settings", () => {
  beforeEach(() => {
    player.preloadNextTrack = false;
    player.transitionMode = "none";
  });
  it("does not enable a disk cache when preloading is enabled", async () => {
    const preload = items.find((item) => item.key === "preloadNextTrack")!;
    expect(preload.confirm).toBeUndefined();
    await preload.action!(true);
    expect(player.transitionMode).toBe("none");
  });
  it("crossfade enables local preloading without a disk cache", async () => {
    const transition = items.find((item) => item.key === "transitionMode")!;
    expect(transition.confirm).toBeUndefined();
    await transition.action!("crossfade");
    expect(player.preloadNextTrack).toBe(true);
  });
  it("disabling preloading also disables crossfade", async () => {
    player.transitionMode = "crossfade";
    await items.find((item) => item.key === "preloadNextTrack")!.action!(false);
    expect(player.transitionMode).toBe("none");
  });
  it("enables screen-awake by default without overriding a saved off preference", () => {
    expect(defaultSystemConfig.player.keepScreenAwake).toBe(true);
    expect(
      deepMerge(defaultSystemConfig, { player: { keepScreenAwake: false } }).player.keepScreenAwake,
    ).toBe(false);
    expect(items.find((item) => item.key === "keepScreenAwake")).toMatchObject({
      type: "switch",
      defaultValue: true,
      binding: { store: "settings", path: "system.player.keepScreenAwake" },
    });
  });
});

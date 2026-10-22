import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHotkeyConfig } from "@shared/defaults/hotkeys";
import { useHotkeyStore } from "./hotkey";

beforeEach(() => setActivePinia(createPinia()));
describe("renderer shortcut defaults", () => {
  it("starts disabled before main-process configuration arrives", () => {
    expect(useHotkeyStore().globalEnabled).toBe(false);
  });
  it("honors an existing user's saved opt-in after initialization", async () => {
    Object.assign(window, {
      api: {
        hotkey: {
          getAll: vi.fn().mockResolvedValue({ ...defaultHotkeyConfig, globalEnabled: true }),
          getConflicts: vi.fn().mockResolvedValue([]),
          onConflicts: vi.fn(() => () => {}),
        },
      },
    });
    const store = useHotkeyStore();
    await store.init();
    expect(store.globalEnabled).toBe(true);
    store.$dispose();
  });
});

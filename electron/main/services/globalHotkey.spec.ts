import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HotkeyConfig } from "@shared/types/hotkey";
import { defaultHotkeyConfig } from "@shared/defaults/hotkeys";

const mocks = vi.hoisted(() => ({
  saved: undefined as Partial<HotkeyConfig> | undefined,
  register: vi.fn(() => true),
  unregisterAll: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { on: vi.fn() },
  globalShortcut: { register: mocks.register, unregisterAll: mocks.unregisterAll },
}));
vi.mock("@main/store", () => ({
  store: {
    get: () => mocks.saved,
    set: (_key: string, config: HotkeyConfig) => {
      mocks.saved = config;
    },
  },
}));
vi.mock("@main/utils/broadcast", () => ({ broadcast: mocks.broadcast }));
vi.mock("@main/utils/logger", () => ({ coreLog: { warn: vi.fn() } }));
import { initGlobalHotkey, getHotkeyConfig, setGlobalEnabled, resetBindings } from "./globalHotkey";

beforeEach(() => {
  mocks.saved = undefined;
});

describe("global shortcut defaults", () => {
  it("does not register shortcuts on a fresh install", () => {
    expect(defaultHotkeyConfig.globalEnabled).toBe(false);
    initGlobalHotkey();
    expect(getHotkeyConfig().globalEnabled).toBe(false);
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.unregisterAll).toHaveBeenCalledOnce();
    expect(getHotkeyConfig().bindings["player.togglePlay"].inApp).toBe("Space");
  });
  it("defaults incomplete saved configurations to off", () => {
    mocks.saved = { bindings: defaultHotkeyConfig.bindings };
    initGlobalHotkey();
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("honors an explicitly saved opt-in", () => {
    mocks.saved = { ...defaultHotkeyConfig, globalEnabled: true };
    initGlobalHotkey();
    expect(mocks.register).toHaveBeenCalled();
  });
  it("allows opting in and turns registration off again on reset", () => {
    setGlobalEnabled(true);
    expect(mocks.register).toHaveBeenCalled();
    mocks.register.mockClear();
    expect(resetBindings().globalEnabled).toBe(false);
    expect(mocks.register).not.toHaveBeenCalled();
  });
});

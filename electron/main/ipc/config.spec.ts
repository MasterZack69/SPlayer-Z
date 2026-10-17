import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  set: vi.fn(),
  clear: vi.fn(),
  replaceAll: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("electron", () => ({
  dialog: {},
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => unknown) =>
      mocks.handlers.set(name, handler),
  },
}));
vi.mock("@main/store", () => ({
  store: { set: mocks.set, clear: mocks.clear, replaceAll: mocks.replaceAll },
}));
vi.mock("@main/utils/powerBlocker", () => ({ refreshPowerBlocker: mocks.refresh }));
vi.mock("@main/utils/logger", () => ({ systemLog: {} }));
vi.mock("@main/services/media", () => ({}));
vi.mock("@main/services/lastfm", () => ({}));
vi.mock("@main/services/engine", () => ({}));
vi.mock("@main/window", () => ({}));
vi.mock("@main/services/orpheus", () => ({}));
import { registerConfigIpc } from "./config";

describe("screen-awake configuration side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    registerConfigIpc();
  });
  it.each([
    ["config:set", [null, "player.keepScreenAwake", true], "set"],
    ["config:reset", [], "clear"],
    ["config:replaceAll", [null, { player: { keepScreenAwake: false } }], "replaceAll"],
  ] as const)("%s refreshes inhibitors after saving", (channel, args, method) => {
    mocks.handlers.get(channel)!(...args);
    expect(mocks[method]).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks[method].mock.invocationCallOrder[0]).toBeLessThan(
      mocks.refresh.mock.invocationCallOrder[0],
    );
  });
});

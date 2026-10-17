import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), release: vi.fn() }));
vi.mock("@main/utils/powerBlocker", () => ({
  updatePowerBlocker: mocks.update,
  releasePowerBlocker: mocks.release,
}));
vi.mock("@main/utils/broadcast", () => ({ sendToMain: vi.fn() }));
vi.mock("@main/utils/logger", () => ({ playerLog: { info: vi.fn(), warn: vi.fn() } }));

describe("audio recovery sleep inhibition", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it.each([
    ["playing", false, true],
    ["paused", false, false],
    ["playing", true, false],
  ] as const)("reconciles %s / finished %s after recovery", async (state, isFinished, expected) => {
    const device = await import("./device");
    const player = {
      reinitOutput: vi.fn().mockResolvedValue(undefined),
      getStatus: () => ({ state, isFinished }),
      getDefaultDeviceId: () => "default",
      supportsDeviceWatcher: () => false,
      stopDeviceWatcher: vi.fn(),
    };
    device.startDeviceMonitoring(player as never);
    device.requestReinit(player as never);
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(expected);
    device.stopDeviceMonitoring();
  });
  it("releases inhibition when both recovery attempts fail", async () => {
    const device = await import("./device");
    const player = {
      reinitOutput: vi.fn().mockRejectedValue(new Error("device missing")),
      getDefaultDeviceId: () => "default",
      supportsDeviceWatcher: () => false,
      stopDeviceWatcher: vi.fn(),
    };
    device.startDeviceMonitoring(player as never);
    device.requestReinit(player as never);
    await vi.advanceTimersByTimeAsync(600);
    expect(player.reinitOutput).toHaveBeenCalledTimes(2);
    expect(mocks.release).toHaveBeenCalledOnce();
    device.stopDeviceMonitoring();
  });
});

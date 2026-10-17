import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: false, nextId: 0, start: vi.fn(), stop: vi.fn() }));
vi.mock("electron", () => ({ powerSaveBlocker: { start: mocks.start, stop: mocks.stop } }));
vi.mock("@main/store", () => ({ store: { get: () => mocks.enabled } }));
vi.mock("./logger", () => ({ systemLog: { info: vi.fn() } }));

describe("playback power inhibition", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.enabled = false;
    mocks.nextId = 0;
    mocks.start.mockImplementation(() => mocks.nextId++);
  });
  it("never inhibits sleep when disabled, whether idle or playing", async () => {
    const service = await import("./powerBlocker");
    service.updatePowerBlocker(false);
    service.refreshPowerBlocker();
    service.updatePowerBlocker(true);
    service.updatePowerBlocker(true);
    service.refreshPowerBlocker();
    service.releasePowerBlocker();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
  });
  it("keeps the display awake only while playing and releases it on pause", async () => {
    mocks.enabled = true;
    const service = await import("./powerBlocker");
    service.updatePowerBlocker(false);
    expect(mocks.start).not.toHaveBeenCalled();
    service.updatePowerBlocker(true);
    expect(mocks.start).toHaveBeenLastCalledWith("prevent-display-sleep");
    service.updatePowerBlocker(false);
    expect(mocks.stop).toHaveBeenCalledWith(0);
    service.releasePowerBlocker();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });
  it("releases immediately when disabled and reacquires only if enabled while playing", async () => {
    const service = await import("./powerBlocker");
    service.updatePowerBlocker(true);
    expect(mocks.start).not.toHaveBeenCalled();
    mocks.enabled = true;
    service.refreshPowerBlocker();
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith("prevent-display-sleep");
    mocks.enabled = false;
    service.refreshPowerBlocker();
    expect(mocks.stop).toHaveBeenCalledExactlyOnceWith(0);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    service.refreshPowerBlocker();
    service.updatePowerBlocker(true);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    mocks.enabled = true;
    service.refreshPowerBlocker();
    expect(mocks.start).toHaveBeenCalledTimes(2);
    service.releasePowerBlocker();
    expect(mocks.stop).toHaveBeenLastCalledWith(1);
  });
  it("never reacquires a lock from a settings refresh after a terminal release", async () => {
    mocks.enabled = true;
    const service = await import("./powerBlocker");
    service.updatePowerBlocker(true);
    service.releasePowerBlocker();
    mocks.start.mockClear();
    service.refreshPowerBlocker();
    service.releasePowerBlocker();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.stop).toHaveBeenCalledExactlyOnceWith(0);
  });
  it("does not acquire a display lock while stopped even when enabled", async () => {
    mocks.enabled = true;
    const service = await import("./powerBlocker");
    service.updatePowerBlocker(false);
    service.refreshPowerBlocker();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});

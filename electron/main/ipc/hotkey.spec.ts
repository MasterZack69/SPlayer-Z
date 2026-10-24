import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ handle: vi.fn(), setRecording: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: mocks.handle } }));
vi.mock("@main/services/globalHotkey", () => ({
  getHotkeyConfig: vi.fn(),
  setBinding: vi.fn(),
  resetBindings: vi.fn(),
  setGlobalEnabled: vi.fn(),
  probeAccelerator: vi.fn(),
  getConflicts: vi.fn(),
  setRecording: mocks.setRecording,
}));
import { registerHotkeyIpc } from "./hotkey";

beforeEach(() => {
  vi.clearAllMocks();
});
describe("global shortcut recording ownership", () => {
  for (const event of ["destroyed", "render-process-gone", "did-start-navigation"]) {
    it(`restores shortcuts when the recording renderer emits ${event}`, () => {
      registerHotkeyIpc();
      const handler = mocks.handle.mock.calls.find(([name]) => name === "hotkey:setRecording")![1];
      const owner = new EventEmitter();
      handler({ sender: owner }, true);
      expect(mocks.setRecording).toHaveBeenLastCalledWith(true);
      owner.emit(event);
      expect(mocks.setRecording).toHaveBeenLastCalledWith(false);
      for (const name of ["destroyed", "render-process-gone", "did-start-navigation"]) {
        expect(owner.listenerCount(name)).toBe(0);
      }
    });
  }
  it("ignores stop requests from unrelated windows", () => {
    registerHotkeyIpc();
    const handler = mocks.handle.mock.calls.find(([name]) => name === "hotkey:setRecording")![1];
    const owner = new EventEmitter();
    handler({ sender: owner }, true);
    handler({ sender: new EventEmitter() }, false);
    expect(mocks.setRecording).toHaveBeenLastCalledWith(true);
    handler({ sender: owner }, false);
    expect(mocks.setRecording).toHaveBeenLastCalledWith(false);
  });
});

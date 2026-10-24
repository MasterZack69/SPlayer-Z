import { effectScope } from "vue";
import { describe, it, expect, vi } from "vitest";
import { useHotkeyRecorder } from "./recorder";
import { hotkeyRecording } from "./recording";

describe("shortcut recording lifecycle", () => {
  it("restores shortcuts on scope disposal and ignores later keyboard events", () => {
    const scope = effectScope();
    const onConfirm = vi.fn();
    const onRecordingChange = vi.fn();
    scope.run(() => useHotkeyRecorder({ onConfirm, onRecordingChange }).start());
    expect(hotkeyRecording.value).toBe(true);
    scope.stop();
    expect(hotkeyRecording.value).toBe(false);
    expect(onRecordingChange.mock.calls).toEqual([[true], [false]]);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("cancels Escape and accepts numpad keys", () => {
    const scope = effectScope();
    const onConfirm = vi.fn();
    const recorder = scope.run(() => useHotkeyRecorder({ onConfirm }))!;
    recorder.start();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" }));
    expect(recorder.isRecording.value).toBe(false);
    recorder.start();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Numpad2", key: "2", ctrlKey: true }),
    );
    expect(onConfirm).toHaveBeenCalledWith("CommandOrControl+num2");
    expect(hotkeyRecording.value).toBe(false);
    scope.stop();
  });
});

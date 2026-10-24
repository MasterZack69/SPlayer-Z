import { ipcMain, type WebContents } from "electron";
import {
  getHotkeyConfig,
  setBinding,
  resetBindings,
  setGlobalEnabled,
  probeAccelerator,
  getConflicts,
  setRecording,
} from "@main/services/globalHotkey";
import type { HotkeyActionId, HotkeyBinding } from "@shared/types/hotkey";

/** Shortcut IPC handlers */
export const registerHotkeyIpc = (): void => {
  // Read all shortcut bindings
  ipcMain.handle("hotkey:getAll", () => getHotkeyConfig());

  // Update a binding and re-register global shortcuts
  ipcMain.handle("hotkey:set", (_event, id: HotkeyActionId, binding: HotkeyBinding) =>
    setBinding(id, binding),
  );

  // Reset one binding or all bindings
  ipcMain.handle("hotkey:reset", (_event, id?: HotkeyActionId) => resetBindings(id));

  // Enable or disable global shortcuts
  ipcMain.handle("hotkey:setGlobalEnabled", (_event, enabled: boolean) =>
    setGlobalEnabled(enabled),
  );

  // Probe system registration availability
  ipcMain.handle("hotkey:probe", (_event, accel: string) => probeAccelerator(accel));

  // Restore shortcuts if the recording renderer reloads, crashes, or closes.
  let recordingOwner: WebContents | undefined;
  const releaseRecording = (): void => {
    recordingOwner?.removeListener("destroyed", releaseRecording);
    recordingOwner?.removeListener("render-process-gone", releaseRecording);
    recordingOwner?.removeListener("did-start-navigation", releaseRecording);
    recordingOwner = undefined;
    setRecording(false);
  };
  ipcMain.handle("hotkey:setRecording", (event, recording: boolean) => {
    if (!recording) {
      if (recordingOwner === event.sender) releaseRecording();
      return;
    }
    if (recordingOwner === event.sender) return;
    releaseRecording();
    recordingOwner = event.sender;
    recordingOwner.once("destroyed", releaseRecording);
    recordingOwner.once("render-process-gone", releaseRecording);
    recordingOwner.once("did-start-navigation", releaseRecording);
    setRecording(true);
  });

  // Read current conflicts
  ipcMain.handle("hotkey:getConflicts", () => getConflicts());
};

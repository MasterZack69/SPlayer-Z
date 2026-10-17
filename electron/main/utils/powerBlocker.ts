import { powerSaveBlocker } from "electron";
import { store } from "@main/store";
import { systemLog } from "./logger";

let blockerId: number | null = null;
let blockerType: "prevent-app-suspension" | "prevent-display-sleep" | null = null;
let playing = false;

/** Apply the saved screen-awake preference to the current playback state. */
export const refreshPowerBlocker = (): void => {
  const desired =
    playing && store.get("player.keepScreenAwake")
      ? "prevent-display-sleep"
      : playing
        ? "prevent-app-suspension"
        : null;
  if (desired === blockerType) return;
  const previous = blockerId;
  blockerId = desired ? powerSaveBlocker.start(desired) : null;
  blockerType = desired;
  if (previous !== null) powerSaveBlocker.stop(previous);
  systemLog.info(`Playback power inhibition: ${desired ?? "off"}`);
};

/** Inhibit sleep only while audio is actually playing, never while loading.
 * @param isPlaying - Whether the current native player is actively playing audio.
 */
export const updatePowerBlocker = (isPlaying: boolean): void => {
  playing = isPlaying;
  refreshPowerBlocker();
};

/** Release all playback power inhibitors on pause, stop, failure, reset, or exit. */
export const releasePowerBlocker = (): void => updatePowerBlocker(false);

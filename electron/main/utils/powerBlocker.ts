import { powerSaveBlocker } from "electron";
import { store } from "@main/store";
import { systemLog } from "./logger";

let blockerId: number | null = null;
let blockerType: "prevent-app-suspension" | "prevent-display-sleep" | null = null;
let active = false;
let playing = false;

/** Apply the saved screen-awake preference to the current playback state. */
export const refreshPowerBlocker = (): void => {
  const desired =
    playing && store.get("player.keepScreenAwake")
      ? "prevent-display-sleep"
      : active
        ? "prevent-app-suspension"
        : null;
  if (desired === blockerType) return;
  const previous = blockerId;
  blockerId = desired ? powerSaveBlocker.start(desired) : null;
  blockerType = desired;
  if (previous !== null) powerSaveBlocker.stop(previous);
  systemLog.info(`Playback power inhibition: ${desired ?? "off"}`);
};

/** Update inhibitors without blocking display sleep when playback is paused or loading.
 * @param playbackActive - Playback is running or loading and needs system-sleep protection.
 * @param isPlaying - Audio is actively playing, allowing optional display-sleep protection.
 */
export const updatePowerBlocker = (playbackActive: boolean, isPlaying = playbackActive): void => {
  active = playbackActive;
  playing = isPlaying;
  refreshPowerBlocker();
};

/** Release all playback power inhibitors before the application exits. */
export const releasePowerBlocker = (): void => updatePowerBlocker(false, false);

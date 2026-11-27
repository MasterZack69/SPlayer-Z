import { ipcMain } from "electron";
import type { Track } from "@shared/types/player";
import type { AudioAnalysis } from "@shared/types/analysis";
import { getEngine } from "@main/services/engine";
import { resolveStreamingMediaSource } from "@main/services/streaming/mediaSource";
import { streamingLog } from "@main/utils/logger";

let requestGeneration = 0;

/** Register isolated analysis of local and authorized server tracks. */
export const registerAnalysisIpc = (): void => {
  ipcMain.handle("analysis:analyze", async (_event, track: Track): Promise<AudioAnalysis> => {
    const current = ++requestGeneration;
    try {
      let source: string;
      if (track.source === "local" && (track.cueAudioPath || track.path)) {
        source = (track.cueAudioPath ?? track.path)!;
      } else if (track.source === "streaming" && track.serverId && track.originalId) {
        const resolved = await resolveStreamingMediaSource(
          track.serverId,
          track.originalId,
          crypto.randomUUID(),
          undefined,
          track.serverRevision,
        );
        source = resolved.url;
      } else {
        throw new Error("This track cannot be analyzed");
      }
      if (current !== requestGeneration) throw new Error("Analysis cancelled");
      const native = await getEngine().analyzeAudio(
        source,
        track.cueStartMs ?? 0,
        track.cueEndMs ?? 0,
      );
      return { ...native, spectrogram: new Uint8Array(native.spectrogram) };
    } catch (error) {
      streamingLog.warn("Audio analysis failed", error instanceof Error ? error.name : "unknown");
      throw new Error("Audio analysis failed");
    }
  });
  ipcMain.handle("analysis:cancel", () => {
    requestGeneration++;
    getEngine().cancelAudioAnalysis();
  });
};

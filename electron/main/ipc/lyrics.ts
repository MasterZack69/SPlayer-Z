import { ipcMain, dialog } from "electron";
import { matchLocalTTML } from "@main/services/localLyricRepo";
import { coreLog } from "@main/utils/logger";
import type { LyricTTMLResponse } from "@shared/types/lyrics";
import type { Track } from "@shared/types/player";

/** 注册本地歌词库 IPC，不提供在线匹配入口 */
export const registerLyricsIpc = (): void => {
  ipcMain.handle(
    "lyrics:matchLocalTTML",
    async (_evt, track: Track): Promise<LyricTTMLResponse> => {
      try {
        return { ok: true, data: await matchLocalTTML(track) };
      } catch (err) {
        coreLog.warn(`[lyrics] matchLocalTTML(${track.title}) failed:`, err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );
  ipcMain.handle("lyrics:pickLyricRepoDir", async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: "选择本地 TTML 歌词库目录",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
};

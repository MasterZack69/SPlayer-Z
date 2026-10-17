import fs from "node:fs/promises";
import { dialog, ipcMain } from "electron";
import { store } from "@main/store";
import type { ConfigPath } from "@main/store/types";
import { systemLog } from "@main/utils/logger";
import {
  enable as enableMedia,
  disable as disableMedia,
  reloadDiscordConfig,
} from "@main/services/media";
import { reloadConfig as reloadLastfmConfig } from "@main/services/lastfm";
import {
  setNormalizationEnabled,
  setEqualizerEnabled,
  setEqualizerBands,
  setPreampGain,
} from "@main/services/engine";
import { applyMainWindowZoom } from "@main/window";

import { setOrpheusProtocolRegistered } from "@main/services/orpheus";
import { getUpdateState, syncUpdateChannel } from "@main/services/updater";
import { UPDATE_CHANNELS } from "@shared/types/settings";

/**
 * Apply integration and playback changes after saving configuration.
 * @param keyPath - Updated configuration path.
 * @param value - Saved configuration value.
 */
const applyConfigChange = (keyPath: string, value: unknown): void => {
  switch (keyPath) {
    case "update.channel":
      syncUpdateChannel();
      break;
    case "media.systemMediaControls":
      value ? enableMedia() : disableMedia();
      break;
    case "media.discord.enabled":
    case "media.discord.showWhenPaused":
    case "media.discord.displayMode":
      reloadDiscordConfig();
      break;
    case "lastfm.enabled":
    case "lastfm.scrobble":
    case "lastfm.nowPlaying":
    case "lastfm.loveSync":
      reloadLastfmConfig();
      break;
    case "player.loudnessNormalization":
      setNormalizationEnabled(value as boolean);
      break;
    case "player.equalizer.enabled":
      setEqualizerEnabled(value as boolean);
      break;
    case "player.equalizer.bands":
      setEqualizerBands(value as number[]);
      break;
    case "player.equalizer.preamp":
      setPreampGain(value as number);
      break;
    case "system.registerOrpheusProtocol":
      setOrpheusProtocolRegistered(value as boolean);
      break;
    case "system.uiZoom":
      applyMainWindowZoom();
      break;
  }
};

/** 注册配置相关 IPC */
export const registerConfigIpc = (): void => {
  ipcMain.handle("config:get", (_event, keyPath: string) => store.get(keyPath as ConfigPath));
  ipcMain.handle("config:set", (_event, keyPath: string, value: unknown) => {
    if (keyPath === "update.channel" && getUpdateState().phase === "installing") {
      throw new Error("安装启动中，无法切换更新通道");
    }
    if (keyPath === "update.channel" && !UPDATE_CHANNELS.some((channel) => channel === value)) {
      throw new Error(`无效的更新通道: ${String(value)}`);
    }
    store.set(keyPath, value);
    applyConfigChange(keyPath, value);
  });
  ipcMain.handle("config:getAll", () => store.store);
  ipcMain.handle("config:reset", () => {
    if (getUpdateState().phase === "installing") throw new Error("安装启动中，无法重置配置");
    store.clear();
    syncUpdateChannel();
  });

  /** 替换整盘配置 */
  ipcMain.handle("config:replaceAll", (_event, payload: unknown) => {
    if (getUpdateState().phase === "installing") throw new Error("安装启动中，无法替换配置");
    store.replaceAll(payload);
    syncUpdateChannel();
  });

  /** 备份 */
  ipcMain.handle(
    "config:exportToFile",
    async (
      _event,
      payload: unknown,
    ): Promise<{ ok: boolean; reason?: "canceled" | "writeFailed" }> => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const result = await dialog.showSaveDialog({
        title: "导出设置备份",
        defaultPath: `splayer-settings-${stamp}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, reason: "canceled" };
      try {
        await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
        systemLog.info(`[config] settings exported to ${result.filePath}`);
        return { ok: true };
      } catch (err) {
        systemLog.error("[config] exportToFile failed", err);
        return { ok: false, reason: "writeFailed" };
      }
    },
  );

  /** 恢复 */
  ipcMain.handle(
    "config:importFromFile",
    async (): Promise<
      { ok: true; data: unknown } | { ok: false; reason: "canceled" | "readFailed" | "parseFailed" }
    > => {
      const result = await dialog.showOpenDialog({
        title: "选择设置备份文件",
        filters: [{ name: "JSON", extensions: ["json"] }],
        properties: ["openFile"],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, reason: "canceled" };
      }
      try {
        const text = await fs.readFile(result.filePaths[0], "utf-8");
        try {
          return { ok: true, data: JSON.parse(text) };
        } catch (err) {
          systemLog.error("[config] importFromFile parse failed", err);
          return { ok: false, reason: "parseFailed" };
        }
      } catch (err) {
        systemLog.error("[config] importFromFile read failed", err);
        return { ok: false, reason: "readFailed" };
      }
    },
  );
};

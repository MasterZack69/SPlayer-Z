import { registerSystemIpc } from "./system";
import { registerPlayerIpc } from "./player";
import { registerConfigIpc } from "./config";
import { registerLibraryIpc } from "./library";
import { registerNowPlayingIpc } from "./nowPlaying";
import { registerWindowIpc } from "./window";
import { registerHotkeyIpc } from "./hotkey";
import { registerThemeIpc } from "./theme";
import { registerStreamingIpc } from "./streaming";
import { registerLastfmIpc } from "./lastfm";
import { registerCacheIpc } from "./cache";
import { registerStatsIpc } from "./stats";
import { registerPlaylistIpc } from "./playlist";
import { registerOpenccIpc } from "./opencc";

/**
 * 注册所有 IPC 处理
 * @param onStartupComplete - 主界面启动完成后执行的应用初始化回调
 */
export const registerIpcHandlers = (onStartupComplete: () => void): void => {
  registerSystemIpc();
  registerPlayerIpc();
  registerConfigIpc();
  registerLibraryIpc();
  registerNowPlayingIpc();
  registerWindowIpc(onStartupComplete);
  registerOpenccIpc();
  registerHotkeyIpc();
  registerThemeIpc();
  registerStreamingIpc();
  registerPlaylistIpc();
  registerLastfmIpc();
  registerCacheIpc();
  registerStatsIpc();
};

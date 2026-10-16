import { app, dialog, ipcMain } from "electron";

import { coreLog } from "@main/utils/logger";
import {
  minimizeMainWindow,
  toggleMaximizeMainWindow,
  isMainWindowMaximized,
  toggleFullscreenMainWindow,
  isMainWindowFullscreen,
  hideMainWindow,
  getMainWindow,
  showReadyMainWindow,
} from "@main/window";

/**
 * 注册窗口管理 IPC
 * @param onStartupComplete - 由应用核心提供的启动完成回调
 */
export const registerWindowIpc = (onStartupComplete: () => void): void => {
  ipcMain.handle("window:ready", (event) => {
    if (event.sender !== getMainWindow()?.webContents) throw new Error("窗口来源无效");
    return showReadyMainWindow();
  });

  ipcMain.handle("window:startupComplete", (event) => {
    if (event.sender !== getMainWindow()?.webContents) throw new Error("窗口来源无效");
    onStartupComplete();
  });

  ipcMain.on("window:startupFailed", (event, error: string) => {
    if (event.sender !== getMainWindow()?.webContents) return;
    coreLog.error("渲染进程启动失败", error);
    dialog.showErrorBox(app.getName(), error);
    app.quit();
  });

  // 主窗口控制
  ipcMain.on("window:minimize", () => minimizeMainWindow());
  ipcMain.on("window:toggleMaximize", () => toggleMaximizeMainWindow());
  ipcMain.handle("window:isMaximized", () => isMainWindowMaximized());
  ipcMain.on("window:toggleFullscreen", () => toggleFullscreenMainWindow());
  ipcMain.handle("window:isFullscreen", () => isMainWindowFullscreen());
  ipcMain.on("window:hide", () => hideMainWindow());
  ipcMain.on("window:quit", () => app.quit());
};

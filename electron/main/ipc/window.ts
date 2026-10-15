import { app, dialog, ipcMain } from "electron";
import { isWin } from "@main/utils/config";
import { coreLog } from "@main/utils/logger";
import {
  toggleTaskbarLyricWindow,
  closeTaskbarLyricWindow,
  getTaskbarLyricWindow,
  updateTaskbarLyricContentWidth,
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

  // 任务栏歌词仅在 Windows 注册
  if (isWin) {
    // 切换任务栏歌词窗口
    ipcMain.handle("window:toggleTaskbarLyric", () => toggleTaskbarLyricWindow());
    // 关闭任务栏歌词窗口
    ipcMain.handle("window:closeTaskbarLyric", () => closeTaskbarLyricWindow());
    // 查询任务栏歌词窗口是否打开
    ipcMain.handle("window:isTaskbarLyricOpen", () => !!getTaskbarLyricWindow());
    ipcMain.on("taskbarLyric:setContentWidth", (_event, width: number) => {
      updateTaskbarLyricContentWidth(width);
    });
  } else {
    ipcMain.handle("window:toggleTaskbarLyric", () => false);
    ipcMain.handle("window:closeTaskbarLyric", () => undefined);
    ipcMain.handle("window:isTaskbarLyricOpen", () => false);
  }

  // 主窗口控制
  ipcMain.on("window:minimize", () => minimizeMainWindow());
  ipcMain.on("window:toggleMaximize", () => toggleMaximizeMainWindow());
  ipcMain.handle("window:isMaximized", () => isMainWindowMaximized());
  ipcMain.on("window:toggleFullscreen", () => toggleFullscreenMainWindow());
  ipcMain.handle("window:isFullscreen", () => isMainWindowFullscreen());
  ipcMain.on("window:hide", () => hideMainWindow());
  ipcMain.on("window:quit", () => app.quit());
};

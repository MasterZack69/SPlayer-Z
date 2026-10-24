import { app, BrowserWindow } from "electron";
import { releasePowerBlocker } from "@main/utils/powerBlocker";
import { configureLinuxGraphics } from "@main/utils/chromium";
import { optimizer } from "@electron-toolkit/utils";
import { createMainWindow, getMainWindow, focusMainWindow } from "@main/window";

import { registerIpcHandlers } from "@main/ipc";
import { init as initMedia, shutdown as shutdownMedia } from "@main/services/media";
import { init as initLastfm } from "@main/services/lastfm";
import { initGlobalHotkey } from "@main/services/globalHotkey";
import { initDatabase, closeDatabase } from "@main/database";
import { registerCacheScheme, handleCacheProtocol } from "@main/utils/protocol";
import { coreLog, initLogger } from "@main/utils/logger";
import {
  initOrpheusRegistration,
  extractOrpheusUrl,
  captureOrpheusUrl,
} from "@main/services/orpheus";
import { extractAudioFiles, captureAudioFiles } from "@main/services/externalFile";

/**
 * Configure Chromium memory limits without discarding user-supplied feature switches
 */
const configureMemoryOptimizations = (): void => {
  const disabled = new Set(
    app.commandLine.getSwitchValue("disable-features").split(",").filter(Boolean),
  );
  disabled.add("SpareRendererForSitePerProcess");
  app.commandLine.appendSwitch("disable-features", [...disabled].join(","));
};

/** Memory sampling interval. */
const MEMORY_LOG_INTERVAL_MS = 10 * 60 * 1000;
/** Delay the first sample to avoid startup fluctuations. */
const MEMORY_LOG_FIRST_DELAY_MS = 60 * 1000;

/** Record process working sets for memory regression comparisons. */
const logProcessMemory = (): void => {
  // Label the main renderer process in memory samples.
  const windowPids = new Map<number, string>();
  const namedWindows: Array<[string, Electron.BrowserWindow | null]> = [["main", getMainWindow()]];
  for (const [name, win] of namedWindows) {
    if (win && !win.isDestroyed()) windowPids.set(win.webContents.getOSProcessId(), name);
  }
  const parts = app.getAppMetrics().map((metric) => {
    const mb = Math.round(metric.memory.workingSetSize / 1024);
    const detail = windowPids.get(metric.pid) ?? metric.name ?? metric.serviceName;
    const label = detail ? `${metric.type}(${detail})` : metric.type;
    return `${label} ${mb}MB`;
  });
  coreLog.info(`Memory usage: ${parts.join(" | ")}`);
};

/**
 * Initialize the application.
 */
export const initApp = (): void => {
  configureMemoryOptimizations();
  configureLinuxGraphics(app.commandLine, process.env);
  // Initialize logging.
  initLogger();
  // Enforce a single application instance.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on("second-instance", (_event, commandLine) => {
    focusMainWindow();
    const url = extractOrpheusUrl(commandLine);
    if (url) captureOrpheusUrl(url);
    const files = extractAudioFiles(commandLine);
    if (files.length > 0) captureAudioFiles(files);
  });
  // Register the cache protocol scheme.
  registerCacheScheme();
  // Initialize application services.
  app.whenReady().then(() => {
    // Handle cache:// requests.
    handleCacheProtocol();
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });
    // Register IPC handlers.
    registerIpcHandlers(() => {});
    // Initialize the database.
    initDatabase();
    // Create the main window.
    const mainWindow = createMainWindow();
    // Initialize MPRIS before renderer playback settings are synchronized.
    mainWindow.once("show", () => {
      initMedia();
    });
    // Register the orpheus protocol and handle cold-start requests.
    initOrpheusRegistration();
    const coldOrpheusUrl = extractOrpheusUrl(process.argv);
    if (coldOrpheusUrl) captureOrpheusUrl(coldOrpheusUrl);
    const coldAudioFiles = extractAudioFiles(process.argv);
    if (coldAudioFiles.length > 0) captureAudioFiles(coldAudioFiles);
    // Initialize Last.fm.
    void initLastfm();

    // Register global shortcuts.
    initGlobalHotkey();
    // Sample process memory periodically.
    setTimeout(logProcessMemory, MEMORY_LOG_FIRST_DELAY_MS);
    setInterval(logProcessMemory, MEMORY_LOG_INTERVAL_MS);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
    coreLog.info("Application initialized.");
  });
  // Exit when all windows close.
  app.on("window-all-closed", () => {
    app.quit();
  });
  /** Release resources before exiting. */
  app.on("before-quit", () => {
    coreLog.info("Application exiting; releasing resources.");
    releasePowerBlocker();
    shutdownMedia();
    closeDatabase();
  });
};

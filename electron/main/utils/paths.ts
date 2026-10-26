import { app } from "electron";
import path from "node:path";

/**
 * Application data root.
 *
 * Application configuration, databases, caches, and logs are stored here.
 * Separate application data from Chromium caches for straightforward backups.
 * Respect the Linux XDG user-data path selected by Electron.
 */
export const dataRoot = path.join(app.getPath("userData"), "app-data");

/** Configuration directory: settings.json / streaming.json / lastfm.json */
export const configDir = path.join(dataRoot, "config");

/** Database directory: library.db */
export const databaseDir = path.join(dataRoot, "database");

/** Default cache directory: covers / backgrounds */
export const defaultCacheDir = path.join(dataRoot, "cache");

/** Log directory: application logs and native/. */
export const logsDir = path.join(dataRoot, "logs");

/** Legacy plugin data directory; retained for existing data paths. */
export const pluginsDir = path.join(dataRoot, "plugins");

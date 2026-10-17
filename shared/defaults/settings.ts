import type { SystemConfig } from "../types/settings";
import { defaultPluginsConfig } from "./plugin-api";
import { defaultHotkeyConfig } from "./hotkeys";

/**
 * 灵动岛基准高度（缩放比例 = 1 时的物理像素，等于"主行高度")
 * 主行高度 = DYNAMIC_ISLAND_BASE_HEIGHT * scale
 * 双行模式下窗口最终高度 = 主行高度 + 副行高度
 * 主进程按渲染端上报的最终高度 setBounds
 */
export const DYNAMIC_ISLAND_BASE_HEIGHT = 40;

/** 默认配置 */
export const defaultSystemConfig: SystemConfig = {
  player: {
    autoPlay: false,
    keepScreenAwake: true,
    rememberLastTrack: true,
    fadeEnabled: true,
    fadeDuration: 200,
    outputDevice: null,
    volume: 1,
    loudnessNormalization: false,
    equalizer: {
      enabled: false,
      preset: "flat",
      bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      preamp: 0,
    },
    lyricOffsets: {},
  },
  media: {
    systemMediaControls: true,
  },
  library: {
    scanDirs: [],
  },
  lyric: {
    enableOnlineTTMLLyric: false,
    amllDbServer: "https://amlldb.bikonoo.com/%p/%s.ttml",
  },
  cache: {
    dir: null,
  },
  download: {
    enabled: false,
    dir: null,
    quality: "lossless",
    usePlaybackForDownload: false,
    fileTemplate: "{artist} - {title}",
    folderScheme: "none",
    overwritePolicy: "rename",
    embedCover: true,
    embedMeta: true,
    embedLyric: true,
    writeLrc: false,
    saveTtml: false,
    lyricFileFormat: "enhanced-lrc",
  },
  streaming: {
    enabled: true,
  },
  lastfm: {
    enabled: false,
    scrobble: true,
    nowPlaying: true,
    loveSync: true,
  },
  externalApi: {
    enabled: false,
    wsEnabled: false,
    allowLan: false,
    port: 14558,
  },
  mcp: {
    enabled: false,
    port: 14559,
    accessKey: "",
  },
  system: {
    rememberWindowState: true,
    borderlessWindow: true,
    uiZoom: 100,
    onboardingCompleted: false,
    agreedAgreementVersion: 1,
    neteaseRealIp: false,
    kugouLoginVersion: "standard",
    registerOrpheusProtocol: false,
  },
  windowStates: {
    main: {
      width: 1280,
      height: 800,
      x: null,
      y: null,
      maximized: false,
    },
  },
  plugins: defaultPluginsConfig,
  hotkeys: defaultHotkeyConfig,
};

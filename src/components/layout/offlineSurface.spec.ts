import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIDEBAR_NAV_META } from "./sidebarNav";
import { DEFAULT_SIDEBAR_NAV_GROUPS } from "@/types/settings";

/**
 * 读取源码以约束不可达服务不能重新进入启动依赖图
 * @param path - 仓库相对路径
 * @returns 文件内容
 */
const source = (path: string): string => readFileSync(path, "utf8");
describe("离线应用功能边界", () => {
  it.each(["/history", "/favorites", "/cloud", "/download"])(
    "侧边栏及新用户默认配置不包含 %s",
    (path) => {
      expect(SIDEBAR_NAV_META[path]).toBeUndefined();
      expect(DEFAULT_SIDEBAR_NAV_GROUPS.flatMap((group) => group.keys)).not.toContain(path);
    },
  );
  it("保留本地库、喜欢和媒体服务器导航", () => {
    expect(SIDEBAR_NAV_META["/library"]).toBeDefined();
    expect(SIDEBAR_NAV_META["/liked"]).toBeDefined();
    expect(SIDEBAR_NAV_META["/streaming"]).toBeDefined();
  });
  it("移除主进程功能注册及服务启动", () => {
    const ipc = source("electron/main/ipc/index.ts");
    for (const feature of [
      "Plugin",
      "Download",
      "Recognition",
      "AiModel",
      "Mcp",
      "ExternalApi",
      "Apis",
      "Cloud",
    ]) {
      expect(ipc).not.toContain(`register${feature}Ipc`);
    }
    const core = source("electron/main/core/index.ts");
    for (const feature of ["pluginRegistry", "initDownload", "startMcpServer", "startServer"])
      expect(core).not.toContain(feature);
    expect(core).toContain("initSongCache");
    expect(ipc).toContain("registerStreamingIpc");
  });
  it("歌词 IPC 仅保留本地歌词库入口", () => {
    const ipc = source("electron/main/ipc/lyrics.ts");
    for (const channel of ["lyrics:matchById", "lyrics:matchByQuery", "lyrics:fetchTTMLOverlay"])
      expect(ipc).not.toContain(channel);
    expect(ipc).toContain("lyrics:matchLocalTTML");
    expect(source("src/components/modals/TagEditorDialog.vue")).not.toContain("matchById");
  });
  it("首页和顶栏不再挂载在线发现、账户及识曲", () => {
    const home = source("src/pages/Home.vue");
    for (const feature of ["useQuickActions", "useHomeDiscover", "useContinueListening"])
      expect(home).not.toContain(feature);
    expect(source("src/components/layout/NavHeader.vue")).not.toContain("<NavUser");
    expect(source("src/components/layout/NavSearch.vue")).not.toContain("RecognitionDialog");
  });
  it("构建不再包含插件和识曲 worker 及外置歌词窗口", () => {
    const config = source("electron.vite.config.ts");
    for (const feature of [
      "host.worker",
      "fingerprint.worker",
      '"desktop-lyric":',
      '"dynamic-island":',
    ])
      expect(config).not.toContain(feature);
    expect(source("electron-builder.config.ts")).not.toContain("native/audio-capture");
    expect(source("electron/main/window/index.ts")).not.toContain('from "./desktopLyric"');
    expect(source("electron/main/window/index.ts")).not.toContain('from "./dynamicIsland"');
  });
});

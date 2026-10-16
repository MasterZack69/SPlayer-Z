/** 窗口管理 API */
export interface WindowApi {
  /** 静态启动层就绪后显示主窗口 */
  ready: () => Promise<void>;
  /** 启动层退出后启动非必要后台服务 */
  startupComplete: () => Promise<void>;
  /** 报告无法完成启动的致命错误，由主进程提示并退出 */
  startupFailed: (error: string) => void;
  /** 最小化主窗口 */
  minimize: () => void;
  /** 切换最大化 / 还原 */
  toggleMaximize: () => void;
  /** 查询主窗口是否最大化 */
  isMaximized: () => Promise<boolean>;
  /** 订阅主窗口最大化状态变化 */
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void;
  /** 切换全屏 */
  toggleFullscreen: () => void;
  /** 查询主窗口是否全屏 */
  isFullscreen: () => Promise<boolean>;
  /** 订阅主窗口全屏状态变化 */
  onFullscreenChange: (callback: (fullscreen: boolean) => void) => () => void;
  /** 隐藏主窗口到托盘 */
  hide: () => void;
  /** 退出应用 */
  quit: () => void;
}

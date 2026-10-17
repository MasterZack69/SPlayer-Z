import type { Track } from "@shared/types/player";
import type { QualityLevel } from "@/utils/quality";
import { streamingSourceForTrack } from "@shared/utils/streamingSource";
import { ErrorCode } from "@shared/types/errors";
import { handleError } from "@/utils/errors";

/** 解析选项 */
export interface ResolveTrackSourceOptions {
  /** 已下载文件加载失败时跳过，继续解析缓存或在线音源 */
  skipDownloaded?: boolean;
  /** 将解析失败原因交给播放流程，供提示和跳曲决策使用 */
  onError?: (error: string) => void;
  /** 要跳过的插件 ID 列表 */
  skipPluginIds?: readonly string[];
  /** 是否跳过官方在线接口，直接进入插件兜底 */
  skipOfficialOnline?: boolean;
  /** 是否静默解析 */
  silent?: boolean;
}

/** 在线 URL 解析结果 */
export type OnlineResolveResult =
  | {
      ok: true;
      url: string;
      isTrial: boolean;
      provider: "official" | "plugin" | "trial";
      pluginId?: string;
    }
  | { ok: false; errorCode: ErrorCode };

/**
 * 拒绝旧队列中的插件音源重试
 * @param _track - 旧队列歌曲
 * @param _quality - 旧音质参数
 * @param _skipPluginIds - 旧插件跳过列表
 * @returns 不支持的音源结果
 */
export const resolveByPlugin = async (
  _track: Track,
  _quality: QualityLevel = "hq",
  _skipPluginIds: readonly string[] = [],
): Promise<OnlineResolveResult> => ({ ok: false, errorCode: ErrorCode.URL_RESOLVE_FAILED });

/**
 * Playable source identity. The legacy fromCache field is always false.
 */
export interface ResolvedTrackSource {
  source: string;
  fromCache: boolean;
  provider: "local" | "download" | "cache" | "streaming" | "official" | "plugin" | "trial";
  pluginId?: string;
}

/**
 * Report a resolution failure, respecting silent mode.
 * @param err - Error message or code.
 * @param options - Notification preferences and error callback.
 */
const reportLoadError = (err: ErrorCode | string, options: ResolveTrackSourceOptions): void => {
  options.onError?.(err);
  if (!options.silent) handleError(err);
};

/**
 * Resolve local files or direct authenticated media-server sources.
 * @param track - Track to resolve.
 * @param options - Error-reporting and legacy queue options.
 * @returns Playable source, or null when unavailable.
 */
export const resolveTrackSource = async (
  track: Track,
  options: ResolveTrackSourceOptions = {},
): Promise<ResolvedTrackSource | null> => {
  // 本地文件
  if (track.source === "local") {
    const localPath = track.cueAudioPath ?? track.path;
    if (!localPath) reportLoadError(ErrorCode.FILE_NOT_FOUND, options);
    return localPath ? { source: localPath, fromCache: false, provider: "local" } : null;
  }
  if (track.source !== "streaming") {
    reportLoadError(ErrorCode.URL_RESOLVE_FAILED, options);
    return null;
  }
  // 流媒体
  if (track.source === "streaming") {
    try {
      const source = streamingSourceForTrack(track);
      const result: ResolvedTrackSource = {
        source,
        fromCache: false,
        provider: "streaming",
      };
      return result;
    } catch (err) {
      reportLoadError(err instanceof Error ? err.message : String(err), options);
      return null;
    }
  }
  return null;
};

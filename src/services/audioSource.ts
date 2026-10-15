import type { Track } from "@shared/types/player";
import type { QualityLevel } from "@/utils/quality";
import { streamingSourceForTrack } from "@shared/utils/streamingSource";
import { useSettingsStore } from "@/stores/settings";
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

/**
 * 为自托管曲目生成隔离的缓存键
 * @param track - 歌曲身份及服务器版本
 * @returns 缓存键或 null
 */
const cacheKeyForTrack = (track: Track): string | null =>
  track.source === "streaming" && track.serverId && track.originalId
    ? `s:${track.serverId}:${track.originalId}:${track.serverRevision ? `r${track.serverRevision}` : ""}`
    : null;

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
 * 解析结果
 * - fromCache 为 true 时表示音源直接命中本地缓存
 * - cacheRequest 存在时表示尚未缓存，调用方应在合适时机（如播放达到阈值后）触发它
 */
export interface ResolvedTrackSource {
  source: string;
  fromCache: boolean;
  provider: "local" | "download" | "cache" | "streaming" | "official" | "plugin" | "trial";
  pluginId?: string;
  /**
   * 下载音源并返回可供原生预载使用的缓存路径
   * @param preloadId - 可选的预载消费者标识，用于缓存租约和独立取消
   * @param signal - 在解析下载地址期间取消任务的信号
   * @returns 缓存路径，未完成下载或已取消时返回 null
   */
  cacheRequest?: (preloadId?: string, signal?: AbortSignal) => Promise<string | null>;
}

/**
 * 记录解析错误，支持静默模式抑制
 * @param err - 错误信息或错误码
 * @param options - 提示方式和错误接收回调
 */
const reportLoadError = (err: ErrorCode | string, options: ResolveTrackSourceOptions): void => {
  options.onError?.(err);
  if (!options.silent) handleError(err);
};

/**
 * 解析歌曲的可播放音源及缓存下载入口
 * @param track - 要解析的歌曲
 * @param options - 错误提示、流媒体会话及在线来源重试选项
 * @returns 本地路径或远端地址及缓存入口，无法解析时返回 null
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
  const settings = useSettingsStore();
  if (track.source !== "streaming") {
    reportLoadError(ErrorCode.URL_RESOLVE_FAILED, options);
    return null;
  }
  const cacheKey = cacheKeyForTrack(track);
  const cacheEnabled = settings.system.cache?.songCache?.enabled === true && cacheKey !== null;
  if (cacheEnabled) {
    const cached = await window.api.cache.song.lookup(cacheKey!);
    if (cached) return { source: cached, fromCache: true, provider: "cache" };
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
      if (cacheEnabled && settings.system.cache.songCache.cacheStreaming) {
        // 缓存下载用独立 PlaySessionId
        result.cacheRequest = async (preloadId, signal) => {
          try {
            if (signal?.aborted) return null;
            return await window.api.cache.song.fetch(cacheKey, "streaming", source, preloadId);
          } catch (err) {
            console.warn("[cache] 流媒体缓存失败", err);
            return null;
          }
        };
      }
      return result;
    } catch (err) {
      reportLoadError(err instanceof Error ? err.message : String(err), options);
      return null;
    }
  }
  return null;
};

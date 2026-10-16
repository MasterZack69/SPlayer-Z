import type { Track, TrackDetail } from "@shared/types/player";
import type { LyricData, LyricFormat, LyricInput } from "@shared/types/lyrics";
import type { Platform } from "@shared/types/platform";
import { detectFormat } from "lyric-kit";
import { useSettingsStore } from "@/stores/settings";
import { DEFAULT_LYRIC_FORMAT_ORDER } from "@/types/settings";
import { requestStreamingLyric } from "./request";

export interface OnlineResult {
  source: { source: "online"; format: LyricFormat; platform: Platform };
  input: LyricInput;
}
export interface ResolvedLyric {
  source: NonNullable<LyricData>;
  input: LyricInput;
}
export type LocalLyric = { source: NonNullable<LyricData>; content: string };

/**
 * 从内嵌标签提取歌词
 * @param detail - 当前歌曲详情
 * @returns 内嵌歌词或 null
 */
export const embeddedLyricFromDetail = (detail: TrackDetail | null): LocalLyric | null =>
  detail?.embeddedLyric
    ? {
        source: { source: "embedded", format: detectFormat(detail.embeddedLyric) },
        content: detail.embeddedLyric,
      }
    : null;

/**
 * 判断 candidateFormat 是否比 currentFormat 更优（优先级更高）
 * @param candidateFormat - 候选格式
 * @param currentFormat - 当前格式（为 null 时直接判定为更优）
 */
export const isBetterFormat = (
  candidateFormat: LyricFormat,
  currentFormat: LyricFormat | null,
): boolean => {
  if (!currentFormat) return true;
  const order = useSettingsStore().lyric.lyricFormatOrder ?? DEFAULT_LYRIC_FORMAT_ORDER;
  const currIdx = order.indexOf(currentFormat);
  const candIdx = order.indexOf(candidateFormat);
  const currRank = currIdx === -1 ? order.length : currIdx;
  const candRank = candIdx === -1 ? order.length : candIdx;
  return candRank < currRank;
};

/**
 * 仅从曲目所属的自托管服务器读取歌词
 * @param track - 服务器曲目
 * @returns 服务器歌词或 null
 */
export const resolveStreamingLyric = async (track: Track): Promise<ResolvedLyric | null> => {
  const text = await requestStreamingLyric(track);
  return text?.trim()
    ? { source: { source: "external", format: detectFormat(text) }, input: { content: text } }
    : null;
};

/**
 * 解析服务器歌词并丢弃过期响应
 * @param track - 服务器曲目
 * @param shouldContinue - 响应是否仍然有效
 * @returns 服务器歌词或 null
 */
export const resolveStreamingByPreference = async (
  track: Track,
  shouldContinue: () => boolean = () => true,
): Promise<ResolvedLyric | null> => {
  const lyric = await resolveStreamingLyric(track);
  return shouldContinue() ? lyric : null;
};

/**
 * 为自托管曲目预载歌词，本地曲目在音频加载后读取标签
 * @param track - 下一首歌曲
 * @param shouldContinue - 响应是否仍然有效
 * @returns Lyrics from the configured media server, or null
 */
export const resolveLyricForPreload = async (
  track: Track,
  shouldContinue: () => boolean,
): Promise<ResolvedLyric | null> => {
  if (track.source !== "streaming") return null;
  return resolveStreamingByPreference(track, shouldContinue);
};

/**
 * 为未移除的旧下载模块提供空结果，不再访问在线歌词服务
 * @param _track - 旧歌曲参数
 * @param _options - 旧来源偏好
 * @returns null
 */
export const resolveOnlineByPreference = async (
  _track: Track,
  _options: {
    hasLocal: boolean;
    localFormat: LyricFormat | null;
    onCandidate?: (result: OnlineResult) => void;
    shouldContinue?: () => boolean;
  },
): Promise<OnlineResult | null> => null;

/**
 * 保持旧下载模块类型兼容，不再访问 TTML 网络服务
 * @param _track - 旧歌曲参数
 * @param _online - 旧在线结果
 * @returns null
 */
export const resolveTTMLOverlay = async (
  _track: Track,
  _online: OnlineResult,
): Promise<ResolvedLyric | null> => null;

/**
 * 保持旧下载模块类型兼容，不再调用插件
 * @param _track - 旧歌曲参数
 * @returns null
 */
export const resolvePluginLyric = async (_track: Track): Promise<ResolvedLyric | null> => null;

/** 旧插件歌词优先开关恒定关闭 */
export const isPluginLyricPreferred = (): boolean => false;

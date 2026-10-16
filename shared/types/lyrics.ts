import type { Platform } from "./platform";
import type {
  LyricFormat,
  LyricInput,
  LyricLine,
  LyricMetadata,
  LyricResult,
  LyricSpan,
  LyricWord,
} from "lyric-kit";

export type {
  LyricFormat,
  LyricInput,
  LyricLine,
  LyricMetadata,
  LyricResult,
  LyricSpan,
  LyricWord,
};

/** 默认格式优先级 */
export const DEFAULT_LYRIC_FORMAT_ORDER: readonly LyricFormat[] = [
  "ttml",
  "lys",
  "qrc",
  "krc",
  "yrc",
  "lrc",
  "ass",
  "srt",
];

/** 歌词来源 */
export type LyricSource = "external" | "embedded" | "online";

/** 歌词数据 */
export type LyricData = {
  source: LyricSource;
  format: LyricFormat;
  /** 在线歌词所属平台，仅 source=online 时有值 */
  platform?: Platform;
} | null;

/** 平台额外字段 */
export interface LyricMatchExtra {
  /** QM 的 mid */
  mid?: string;
}

/** 歌词匹配结果 */
export interface LyricMatchResult extends LyricInput {
  platform: Platform;
  /** 主歌词格式 */
  format: LyricFormat;
  /** 平台额外字段，netease/kugou 暂未使用 */
  extra?: LyricMatchExtra;
}

/** 歌词匹配 IPC 响应 */
export type LyricMatchResponse =
  { ok: true; data: LyricMatchResult | null } | { ok: false; error: string };

/** TTML 抓取 IPC 响应 */
export type LyricTTMLResponse = { ok: true; data: string | null } | { ok: false; error: string };

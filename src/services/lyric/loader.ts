import type { TrackDetail } from "@shared/types/player";
import type { LyricData, LyricFormat, LyricInput } from "@shared/types/lyrics";
import { useMediaStore } from "@/stores/media";
import { useSettingsStore } from "@/stores/settings";
import { DEFAULT_LYRIC_FORMAT_ORDER } from "@/types/settings";
import { embeddedLyricFromDetail, resolveStreamingLyric } from "./resolve";
import { consumePreloadedLyric } from "./preload";

let currentToken = 0;

/**
 * 从外部歌词列表中选出最优格式的索引
 * @param lyrics - 外部歌词列表
 * @param priority - 自定义格式优先级
 * @returns 最优格式的索引，无可用歌词时返回 -1
 */
const bestExternalIndex = (
  lyrics: { format: LyricFormat }[],
  priority?: readonly LyricFormat[],
): number => {
  if (lyrics.length === 0) return -1;
  const order = priority && priority.length > 0 ? priority : DEFAULT_LYRIC_FORMAT_ORDER;
  let bestIdx = 0;
  let bestPriority = order.length;
  for (let i = 0; i < lyrics.length; i++) {
    const p = order.indexOf(lyrics[i].format);
    const rank = p === -1 ? order.length : p;
    if (rank < bestPriority) {
      bestPriority = rank;
      bestIdx = i;
    }
  }
  return bestIdx;
};

/**
 * 读取本地歌词
 * @param detail - 歌曲详细信息
 */
const readLocal = async (
  detail: TrackDetail,
): Promise<{ source: NonNullable<LyricData>; content: string } | null> => {
  const order = useSettingsStore().lyric.lyricFormatOrder ?? DEFAULT_LYRIC_FORMAT_ORDER;
  const idx = bestExternalIndex(detail.externalLyrics, order);
  if (idx !== -1) {
    const ext = detail.externalLyrics[idx];
    const result = await window.api.player.readLyricFile(ext.path);
    if (!result.success || !result.data?.trim()) return embeddedLyricFromDetail(detail);
    return { source: { source: "external", format: ext.format }, content: result.data };
  }
  return embeddedLyricFromDetail(detail);
};

/**
 * 提交歌词
 * @param token - 竞态 token
 * @param source - 歌词源
 * @param input - 歌词内容
 */
const commit = (token: number, source: LyricData, input: LyricInput | null): void => {
  if (token !== currentToken) return;
  useMediaStore().setLyric(source, input);
};

/**
 * 开始歌词加载并清除上一首的状态
 * @returns 当前加载标识
 */
export const beginLoad = (): number => {
  currentToken++;
  useMediaStore().resetLyricState();
  return currentToken;
};

/**
 * Load sidecar files, embedded lyrics, or lyrics from the configured media server
 * @param detail - 当前歌曲详情
 */
export const loadForTrack = async (detail: TrackDetail | null): Promise<void> => {
  const token = beginLoad();
  const media = useMediaStore();
  const track = media.track;
  if (!track || (track.source !== "local" && track.source !== "streaming")) {
    commit(token, null, null);
    return;
  }
  try {
    if (track.source === "streaming") {
      const preloaded = await consumePreloadedLyric(track);
      if (token !== currentToken) return;
      const resolved = preloaded.hit ? preloaded.lyric : await resolveStreamingLyric(track);
      if (token !== currentToken) return;
      if (resolved) {
        commit(token, resolved.source, resolved.input);
        return;
      }
    }
    const local = detail ? await readLocal(detail) : null;
    if (token !== currentToken) return;
    commit(token, local?.source ?? null, local ? { content: local.content } : null);
  } catch (err) {
    console.error("[lyricLoader] 本地歌词加载失败", err);
    const embedded = embeddedLyricFromDetail(detail);
    commit(token, embedded?.source ?? null, embedded ? { content: embedded.content } : null);
  }
};

/** 仅监听仍受支持的本地歌词设置 */
export const watchLyricPreference = (): void => {
  const settings = useSettingsStore();
  watch(
    () => [settings.lyric.lyricFormatOrder.join(","), settings.lyric.detectBackgroundLyrics],
    () => {
      void loadForTrack(useMediaStore().detail);
    },
  );
};

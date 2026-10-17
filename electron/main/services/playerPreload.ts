import { getPlayer, onPlayerReset } from "@main/services/engine";
import { playerLog } from "@main/utils/logger";
import type { TransitionPreference } from "@shared/types/player";
import { TRANSITION_LOOKAHEAD_MS } from "@shared/constants/playback";

let prepared: {
  id: string;
  player: ReturnType<typeof getPlayer>;
  ready: boolean;
  preference?: TransitionPreference;
} | null = null;
let notifiedId: string | null = null;
let currentRange: { startMs: number; endMs: number; analyzed: boolean; tailEndMs?: number } | null =
  null;

/**
 * 只保留当前曲目的尾部判定，加载和停止时清空。
 * @param startMs - 曲目或 CUE 分轨起点，省略时清空
 * @param endMs - 曲目或 CUE 分轨终点
 */
export const setCurrentTransitionRange = (startMs?: number, endMs?: number): void => {
  currentRange = startMs != null && endMs != null ? { startMs, endMs, analyzed: false } : null;
};

/**
 * 返回当前曲目确认的交接终点，播放进度和媒体时长仍使用原始值。
 * @param fallbackMs - 原始终点
 * @param positionMs - 当前源时间
 * @param speed - 播放倍速
 * @returns 包含交接余量的源时间终点
 */
export const getTransitionEndMs = (fallbackMs: number, positionMs = 0, speed = 1): number => {
  if (currentRange?.tailEndMs == null) return fallbackMs;
  // 分析完成时可能已经进入静音，仍留出短暂交接时间，避免错过提前切换。
  return Math.min(
    Math.max(currentRange.tailEndMs, positionMs + 1500 * Math.max(1, speed)),
    fallbackMs,
  );
};

/**
 * 曲尾只通知一次就绪槽位，隐藏窗口也能安排交接
 * @param remainingMs - 当前曲目剩余的源时间
 * @param speed - 当前播放倍速，用于转换成墙钟时间
 * @returns 尚未通知的就绪槽位标识
 */
export const takeTransitionReady = (remainingMs: number, speed = 1): string | null => {
  const remainingWallMs = remainingMs / speed;
  const lookahead = TRANSITION_LOOKAHEAD_MS[prepared?.preference ?? "standard"];
  if (remainingWallMs > lookahead) notifiedId = null;
  if (remainingWallMs < 1000 || remainingWallMs > lookahead || !prepared?.ready) return null;
  if (notifiedId === prepared.id) return null;
  notifiedId = prepared.id;
  return prepared.id;
};

/**
 * Cancel the next-track decoder slot and release its native resources.
 * @param id - Preparation task ID; omit to cancel the current standby slot.
 */
export const cancelPreparedTrack = (id = prepared?.id): void => {
  if (!id) return;
  const current = prepared?.id === id ? prepared : null;
  if (current) prepared = null;
  current?.player.cancelPrepared(id);
};

onPlayerReset(cancelPreparedTrack);

/**
 * Decode a local file into the native standby slot.
 * @param id - Task ID used to cancel or consume prepared resources.
 * @param source - Local audio file path.
 * @param startMs - Start position in milliseconds, including the CUE segment offset.
 * @param preference - Transition preference; omit to skip tail analysis.
 * @returns Whether the task is still current and its audio is ready.
 */
export const prepareNextTrack = async (
  id: string,
  source: string,
  startMs = 0,
  preference?: TransitionPreference,
): Promise<boolean> => {
  cancelPreparedTrack();
  const player = getPlayer();
  prepared = { id, player, ready: false, preference };
  try {
    const ready = await player.prepareNext(id, source, startMs / 1000);
    if (!ready || prepared?.id !== id) {
      player.cancelPrepared(id);
      cancelPreparedTrack(id);
      return false;
    }
    prepared.ready = true;
    const range = currentRange;
    if (preference && range && !range.analyzed) {
      range.analyzed = true;
      const began = performance.now();
      void player
        .analyzeTail(range.startMs / 1000, range.endMs / 1000)
        .then((end) => {
          if (currentRange !== range || end == null) return;
          range.tailEndMs = end * 1000;
          playerLog.info("识别到连续近静音拖尾", {
            trimmedMs: Math.round(range.endMs - range.tailEndMs),
            analysisMs: Math.round(performance.now() - began),
          });
        })
        .catch((error) => {
          if (currentRange === range) playerLog.warn("曲尾分析失败，沿用原始结束位置", error);
        });
    }
    playerLog.info("下一曲 PCM 预载完成", { id, source });
    return true;
  } catch (error) {
    cancelPreparedTrack(id);
    throw error;
  }
};

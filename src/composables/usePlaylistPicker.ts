import type { Track } from "@shared/types/player";
import type { ContentScope } from "@/types/collection";

/**
 * 添加到歌单选择器
 * 在线歌曲未登录时拦截并提示，不打开弹窗
 */
export const usePlaylistPicker = () => {
  /** 弹窗开关 */
  const open = ref(false);
  /** 待添加曲目 */
  const tracks = shallowRef<Track[]>([]);
  /** 本地 / 在线 */
  const mode = ref<ContentScope>("local");

  /**
   * 打开添加到歌单弹窗
   * @param items - 待添加曲目，需同源（local 或 netease）
   */
  const openPicker = (items: Track[]): void => {
    if (items.length === 0) return;
    if (items.some((track) => track.source !== "local")) return;
    tracks.value = items;
    mode.value = "local";
    open.value = true;
  };

  return { open, tracks, mode, openPicker };
};

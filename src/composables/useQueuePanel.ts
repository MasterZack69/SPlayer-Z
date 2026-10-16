import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PlaybackQueueItem, Track } from "@shared/types/player";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";
import { useStatusStore } from "@/stores/status";
import { useMediaStore } from "@/stores/media";
import { useThemeStore } from "@/stores/theme";
import { clearQueue, queue, queueLength, queueEntries } from "@/stores/queue";
import { useDragSort } from "@/composables/useDragSort";
import * as player from "@/core/player";

export interface UseQueuePanelOptions {
  listRef: Ref<SVirtualListExposed | null>;
}

/**
 * Share queue actions and drag ordering between the popover and Now Playing.
 * @param options - Virtual list used for scroll geometry and locating the current track.
 */
export const useQueuePanel = (options: UseQueuePanelOptions) => {
  const { t } = useI18n();
  const statusStore = useStatusStore();
  const mediaStore = useMediaStore();

  /** 拼接艺术家名称 */
  const formatArtists = (artists: Track["artists"]): string => {
    if (!artists?.length) return t("playlist.unknownArtist");
    return artists.map((ar) => ar.name).join(" / ");
  };

  /** 播放指定索引；是否关闭面板交给调用方决定 */
  const playAt = async (index: number): Promise<void> => {
    await player.playAtIndex(index);
  };

  /** 移除单首 */
  const removeAt = (index: number): void => {
    player.removeFromQueue(index);
  };

  const entryKeys = new WeakMap<PlaybackQueueItem, number>();
  let nextEntryKey = 0;

  /**
   * Keep duplicate songs distinct and preserve handle focus when entries move.
   * @param _track - Track supplied by the virtual list.
   * @param index - Current queue-entry position.
   * @returns A stable key without retaining entries after they leave the queue.
   */
  const getQueueItemKey = (_track: Track, index: number): number => {
    const entry = queueEntries.value[index];
    let key = entryKeys.get(entry);
    if (key === undefined) {
      key = nextEntryKey++;
      entryKeys.set(entry, key);
    }
    return key;
  };

  const drag = useDragSort({
    virtualListRef: options.listRef,
    itemCount: queueLength,
    onReorder: (from, to) => player.moveInQueue(from, to),
  });

  // Queue replacement or removal invalidates the indices captured by an active drag.
  watch(queueEntries, () => drag.cleanupDragState(), { flush: "sync" });

  /**
   * Move a focused queue row with the arrow keys without starting playback.
   * @param index - Current queue position.
   * @param direction - One position up or down.
   */
  const moveByKeyboard = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= queueLength.value) return;
    const handle = document.activeElement;
    player.moveInQueue(index, target);
    // Moving a keyed DOM row can blur its button in Chromium.
    void nextTick(() => {
      if (handle instanceof HTMLElement && handle.isConnected) handle.focus();
    });
  };

  const clearConfirmOpen = ref(false);

  /** 清空队列 + 重置播放索引 */
  const clearAll = (): void => {
    if (queueLength.value === 0) return;
    player.stop();
    statusStore.playIndex = -1;
    clearQueue();
    mediaStore.clear();
    useThemeStore().coverColor = null;
    clearConfirmOpen.value = false;
  };

  /** 滚动到当前正在播放项 */
  const scrollToCurrent = (): void => {
    if (statusStore.playIndex >= 0) {
      options.listRef.value?.scrollToIndex(statusStore.playIndex);
    }
  };

  return {
    ...drag,
    moveByKeyboard,
    getQueueItemKey,
    statusStore,
    queue,
    queueLength,
    formatArtists,
    playAt,
    removeAt,
    clearConfirmOpen,
    clearAll,
    scrollToCurrent,
  };
};

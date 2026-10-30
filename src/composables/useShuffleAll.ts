import { computed, markRaw, toValue, type MaybeRefOrGetter } from "vue";
import { useI18n } from "vue-i18n";
import type { PlaybackContext, Track } from "@shared/types/player";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import * as player from "@/core/player";
import IconShuffle from "~icons/lucide/shuffle";

/** Provide a reactive Shuffle All action for the page's playback scope. */
export const useShuffleAll = (
  tracks: MaybeRefOrGetter<readonly Track[]>,
  context?: MaybeRefOrGetter<PlaybackContext | undefined>,
) => {
  const { t } = useI18n();
  const shuffleAllItem = computed<DropdownMenuItem>(() => ({
    key: "shuffleAll",
    label: t("common.shuffleAll"),
    icon: markRaw(IconShuffle),
    disabled: toValue(tracks).length === 0,
  }));

  /** Replace the queue with this scope and start a randomly selected song. */
  const shuffleAll = async (): Promise<void> => {
    const items = toValue(tracks);
    if (items.length === 0) return;
    await player.playFrom(items, { shuffle: true, context: toValue(context) });
  };

  return { shuffleAllItem, shuffleAll };
};

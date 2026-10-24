<script setup lang="ts">
import { useResponsiveLayout } from "@/composables/useResponsiveLayout";
import { useStatusStore } from "@/stores/status";
import { useSettingsStore } from "@/stores/settings";
import { useMediaStore } from "@/stores/media";
import { useLibraryStore } from "@/stores/library";
import type { Track } from "@shared/types/player";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import { useFavorite } from "@/composables/useFavorite";
import { usePlaylistPicker } from "@/composables/usePlaylistPicker";
import { useTrackMenu } from "@/composables/useTrackMenu";
import { useDownload } from "@/composables/useDownload";
import { useProgressLyric } from "@/composables/useProgressLyric";
import * as player from "@/core/player";
import IconFavorite from "~icons/material-symbols/favorite-rounded";
import IconFavoriteOutline from "~icons/material-symbols/favorite-outline-rounded";
import IconLucideMoreHorizontal from "~icons/lucide/more-horizontal";

const status = useStatusStore();
const settings = useSettingsStore();
const media = useMediaStore();
const library = useLibraryStore();
const { t } = useI18n();
const fav = useFavorite();
const { position, duration } = storeToRefs(status);
const { formatTooltip, snapToNearestLyric } = useProgressLyric();

const { isCompact } = useResponsiveLayout();
/** Use compact controls for floating bars and narrow windows */
const useCompactLayout = computed(
  () => settings.appearance.layoutMode === "floating" || isCompact.value,
);
/** 是否显示进度条提示 */
const showTooltip = computed(() => settings.player.showProgressTooltip);

const onSeekDragEnd = (value: number): void => {
  const snappedValue = snapToNearestLyric(value);
  player.seek(snappedValue);
};

/** 添加到歌单 */
const {
  open: pickerOpen,
  tracks: pickerTracks,
  mode: pickerMode,
  openPicker,
} = usePlaylistPicker();

/**
 * Confirm deletion of the selected local file, then remove it from playback.
 * @param track - Track selected when the menu action was invoked.
 */
const deleteTrackFile = async (track: Track): Promise<void> => {
  if (track.source !== "local" || !track.path || track.cuePath) return;
  const { id, path, title } = track;
  const confirmed = await dialog.confirm({
    title: t("songList.delete.fileTitle"),
    content: t("songList.delete.fileConfirmOne", { title }),
    type: "error",
  });
  if (!confirmed) return;
  try {
    const result = await library.deleteTracks([path]);
    if (result.deleted !== 1) {
      toast.error(t("liked.toast.failed"));
      return;
    }
    await player.purgeDeletedTracks([id]);
  } catch (error) {
    toast.error(error instanceof Error && error.message ? error.message : t("liked.toast.failed"));
  }
};

/** 歌曲菜单 */
const { enqueue: enqueueDownload } = useDownload();
const { items: menuItems, handleSelect: onMenuSelect } = useTrackMenu(toRef(media, "track"), {
  hidePlayActions: true,
  onAddToPlaylist: (track) => openPicker([track]),
  onDeleteFile: (track) => void deleteTrackFile(track),
  onDownload: (track, quality) => void enqueueDownload(track, { quality }),
});
</script>

<template>
  <!-- 浮动模式与窄窗口紧凑布局 -->
  <div v-if="useCompactLayout" class="relative flex items-center h-full px-4 gap-4 min-w-0">
    <PlayerControls compact />
    <div class="flex flex-col flex-1 min-w-0 gap-1 pt-2 pb-1">
      <div class="flex items-center gap-2 min-w-0">
        <TrackInfo compact class="flex-1">
          <template #title-trailing>
            <div class="flex items-center shrink-0">
              <SButton
                class="-my-1"
                type="primary"
                variant="text"
                circle
                :size="24"
                :icon-size="16"
                :disabled="!fav.isSupported(media.track)"
                @click="fav.toggle(media.track)"
              >
                <template #icon>
                  <SIconSwap :active="fav.isLiked(media.track)">
                    <template #on><IconFavorite /></template>
                    <template #off><IconFavoriteOutline /></template>
                  </SIconSwap>
                </template>
              </SButton>
              <SDropdownMenu
                v-if="media.track"
                :items="menuItems"
                side="top"
                align="start"
                @select="onMenuSelect"
              >
                <template #trigger>
                  <SButton
                    class="-my-1"
                    type="primary"
                    variant="text"
                    circle
                    :size="24"
                    :icon-size="16"
                  >
                    <template #icon><IconLucideMoreHorizontal /></template>
                  </SButton>
                </template>
              </SDropdownMenu>
            </div>
          </template>
        </TrackInfo>
        <div class="contents lt-md:hidden">
          <PlayerTimeInfo compact />
        </div>
      </div>
      <SSlider
        :model-value="position"
        :glow="status.transitioning"
        :min="0"
        :max="duration"
        :step="100"
        :track-height="3"
        :thumb-size="10"
        :always-show-thumb="false"
        :show-popover="showTooltip"
        @drag-end="onSeekDragEnd"
      >
        <template #popover="{ value }">{{ formatTooltip(value) }}</template>
      </SSlider>
    </div>
    <div class="shrink-0">
      <Toolbar />
    </div>
  </div>
  <!-- 默认模式 -->
  <div v-else class="relative h-full">
    <div class="absolute left-0 right-0 top-0 -translate-y-1/2 z-10">
      <SSlider
        :model-value="position"
        :glow="status.transitioning"
        :min="0"
        :max="duration"
        :step="100"
        :track-height="3"
        :thumb-size="12"
        :always-show-thumb="false"
        :show-popover="showTooltip"
        @drag-end="onSeekDragEnd"
      >
        <template #popover="{ value }">{{ formatTooltip(value) }}</template>
      </SSlider>
    </div>
    <div class="grid grid-cols-[1fr_auto_1fr] items-center h-full px-3 gap-3">
      <TrackInfo>
        <template #title-trailing>
          <div class="flex items-center shrink-0">
            <SButton
              class="-my-1"
              type="primary"
              variant="text"
              circle
              :size="28"
              :icon-size="18"
              :disabled="!fav.isSupported(media.track)"
              @click="fav.toggle(media.track)"
            >
              <template #icon>
                <SIconSwap :active="fav.isLiked(media.track)">
                  <template #on><IconFavorite /></template>
                  <template #off><IconFavoriteOutline /></template>
                </SIconSwap>
              </template>
            </SButton>
            <SDropdownMenu
              v-if="media.track"
              :items="menuItems"
              side="top"
              align="start"
              @select="onMenuSelect"
            >
              <template #trigger>
                <SButton
                  class="-my-1"
                  type="primary"
                  variant="text"
                  circle
                  :size="28"
                  :icon-size="18"
                >
                  <template #icon><IconLucideMoreHorizontal /></template>
                </SButton>
              </template>
            </SDropdownMenu>
          </div>
        </template>
      </TrackInfo>
      <PlayerControls class="mx-15" />
      <div class="flex items-center justify-end gap-2 min-w-0">
        <PlayerTimeInfo />
        <Toolbar />
      </div>
    </div>
  </div>
  <PlaylistPickerDialog v-model:open="pickerOpen" :mode="pickerMode" :tracks="pickerTracks" />
</template>

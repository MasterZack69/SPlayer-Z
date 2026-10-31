<script setup lang="ts">
import { useShuffleAll } from "@/composables/useShuffleAll";
import { usePageSearch } from "@/composables/usePageSearch";
defineOptions({ name: "Liked" });

import type { PlaybackContext, Track } from "@shared/types/player";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import { useLibraryStore } from "@/stores/library";
import SongList from "@/components/list/SongList.vue";
import * as player from "@/core/player";
import IconLucideListChecks from "~icons/lucide/list-checks";

const { t } = useI18n();
const library = useLibraryStore();

const searchQuery = usePageSearch();

/** 本地喜欢列表 */
const localTracks = computed<Track[]>(() => {
  const byId = new Map<string, Track>(library.tracks.map((track) => [track.id, track]));
  const list: Track[] = [];
  for (const id of library.likedOrderedIds) {
    const track = byId.get(id);
    if (track) list.push(track);
  }
  return list;
});

/** 仅展示本地收藏 */
const currentTracks = localTracks;
const playbackContext = computed<PlaybackContext>(() => ({
  originId: "liked",
  originType: "page",
  originName: t("liked.title"),
}));

/** Replace the queue with the displayed songs in their current order. */
const handlePlayAll = (): void => {
  if (currentTracks.value.length === 0) return;
  void player.playFrom(songListRef.value?.playbackItems ?? currentTracks.value, {
    context: playbackContext.value,
    shuffle: false,
  });
};

onMounted(() => {
  if (!library.initialized) library.load();
});

const songListRef = shallowRef<InstanceType<typeof SongList> | null>(null);

/** 更多菜单 */
const { shuffleAllItem, shuffleAll } = useShuffleAll(currentTracks, playbackContext);

const moreMenuItems = computed<DropdownMenuItem[]>(() => {
  const items: DropdownMenuItem[] = [shuffleAllItem.value];
  items.push({
    key: "batch",
    label: t("songList.batch.manage"),
    icon: markRaw(IconLucideListChecks),
  });
  return items;
});

/**
 * 打开本地收藏批量管理
 * @param key - 菜单项标识
 */
const handleMoreMenu = (key: string): void => {
  if (key === "shuffleAll") {
    void shuffleAll();
    return;
  }
  if (key === "batch") songListRef.value?.enterBatch();
};
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 顶栏 -->
    <div class="shrink-0 px-5 pb-2">
      <div class="flex items-center justify-between mt-2 mb-4">
        <div class="flex items-baseline gap-4">
          <h1 class="text-3xl font-bold text-on-surface text-balance">{{ t("liked.title") }}</h1>
          <span
            v-if="currentTracks.length > 0"
            class="text-sm text-on-surface-variant/50 flex items-center gap-1"
          >
            <IconLucideMusic class="size-3.5" />
            {{ t("common.totalSongs", { count: currentTracks.length }) }}
          </span>
        </div>
      </div>
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <SButton
            type="primary"
            variant="secondary"
            round
            :disabled="currentTracks.length === 0"
            @click="handlePlayAll"
          >
            <template #icon>
              <IconLucidePlay />
            </template>
            {{ t("common.playAll") }}
          </SButton>
          <SDropdownMenu :items="moreMenuItems" align="start" @select="handleMoreMenu">
            <template #trigger>
              <SButton variant="secondary" circle>
                <template #icon>
                  <IconLucideEllipsis />
                </template>
              </SButton>
            </template>
          </SDropdownMenu>
        </div>
      </div>
    </div>
    <!-- 列表 -->
    <Transition name="fade" mode="out-in" :duration="150">
      <!-- 本地 tab -->
      <div v-if="localTracks.length > 0" key="local-list" class="flex-1 min-h-0">
        <SongList
          ref="songListRef"
          :items="localTracks"
          :search-query="searchQuery"
          source="local"
          enable-sort
          sort-key="liked.local"
        />
      </div>
      <div v-else key="local-empty" class="flex-1 flex items-center justify-center">
        <div class="text-center text-on-surface-variant/50">
          <IconMaterialSymbolsFavoriteOutlineRounded class="size-12 mx-auto mb-3 opacity-30" />
          <div class="text-sm">{{ t("liked.empty.local") }}</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

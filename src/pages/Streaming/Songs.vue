<script setup lang="ts">
import { getVisibleGenres } from "@shared/utils/genre";
import { useSettingsStore } from "@/stores/settings";
import { matchesSearch } from "@/utils/search/match";
import { usePageSearch } from "@/composables/usePageSearch";
defineOptions({ name: "StreamingSongs" });

import { useStreamingStore } from "@/stores/streaming";
import SongList from "@/components/list/SongList.vue";
import ListPlaybackActions from "@/components/list/ListPlaybackActions.vue";

const { t } = useI18n();
const streaming = useStreamingStore();
const settings = useSettingsStore();
const { songs, loading, isConnected } = storeToRefs(streaming);

const refreshKey = inject("streamingRefreshKey", ref(0));
const searchQuery = usePageSearch();
const favoritesOnly = ref(false);
const visibleSongs = computed(() =>
  songs.value.filter(
    (track) =>
      (!favoritesOnly.value || streaming.isFavorite(track)) &&
      matchesSearch(
        searchQuery.value,
        track.title,
        track.album?.name,
        ...track.artists.map((artist) => artist.name),
        ...getVisibleGenres(track.genres, settings.preset.ignoreMusicGenre),
      ),
  ),
);

/**
 * 刷新当前服务器媒体库
 * @param force - 是否重新读取服务端快照
 */
const refresh = (force = false): void => {
  if (!isConnected.value) return;
  streaming.refreshLibrary(force);
};

// 父组件按刷新按钮时触发
watch(refreshKey, () => refresh(true));
// 连接成功时自动拉
watch(isConnected, (v) => v && refresh());
// 首次挂载：已连接且数据为空才拉（store 有缓存就直接显示，避免重复请求）
onMounted(() => {
  if (isConnected.value && songs.value.length === 0) refresh();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 px-5 py-2 flex items-center justify-between">
      <ListPlaybackActions :items="visibleSongs" />
      <div class="flex items-center gap-2">
        <SButton
          :type="favoritesOnly ? 'primary' : 'default'"
          variant="secondary"
          round
          class="min-h-10"
          :aria-pressed="favoritesOnly"
          @click="favoritesOnly = !favoritesOnly"
        >
          <template #icon><IconLucideHeart /></template>
          {{ t("streaming.favoritesOnly") }}
        </SButton>
      </div>
    </div>
    <div v-if="visibleSongs.length > 0" class="flex-1 min-h-0">
      <SongList :items="visibleSongs" :search-query="searchQuery" source="streaming" />
    </div>
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center text-on-surface-variant/60">
        <IconLucideMusic class="size-12 mx-auto mb-3 opacity-30" />
        <div class="text-sm">
          {{
            loading
              ? t("common.loading")
              : t(
                  searchQuery
                    ? "search.noResults"
                    : favoritesOnly
                      ? "streaming.empty.noFavorites"
                      : "streaming.empty.noResults",
                )
          }}
        </div>
      </div>
    </div>
  </div>
</template>

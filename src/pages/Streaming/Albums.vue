<script setup lang="ts">
import { usePageSearch } from "@/composables/usePageSearch";
defineOptions({ name: "StreamingAlbums" });

import { matchesSearch } from "@/utils/search/match";
import type { CoverItem } from "@/types/artist";
import { useStreamingStore } from "@/stores/streaming";
import { albumsToCoverItems } from "@/utils/format/coverItem";

const { t } = useI18n();
const searchQuery = usePageSearch();
const router = useRouter();
const streaming = useStreamingStore();
const { albums, loading, isConnected } = storeToRefs(streaming);

const refreshKey = inject("streamingRefreshKey", ref(0));

const refresh = (force = false): void => {
  if (!isConnected.value) return;
  streaming.refreshLibrary(force);
};

watch(refreshKey, () => refresh(true));
watch(isConnected, (v) => v && refresh());
onMounted(() => {
  if (isConnected.value && albums.value.length === 0) refresh();
});

const items = computed<CoverItem[]>(() =>
  albumsToCoverItems(albums.value).filter((item) =>
    matchesSearch(searchQuery.value, item.title, item.subtitle),
  ),
);

/**
 * 打开当前服务器的专辑
 * @param item - 专辑封面条目
 */
const handleClick = (item: CoverItem): void => {
  router.push({
    path: `/collection/streaming/album/${encodeURIComponent(item.id)}`,
    query: { serverId: streaming.activeServerId ?? undefined },
  });
};
</script>

<template>
  <div class="h-full">
    <CoverList
      v-if="items.length > 0"
      :items="items"
      :padding-x="20"
      :padding-top="8"
      :padding-bottom="20"
      @click="handleClick"
    />
    <div v-else class="h-full flex items-center justify-center">
      <div class="text-center text-on-surface-variant/60">
        <IconLucideDisc3 class="size-12 mx-auto mb-3 opacity-30" />
        <div class="text-sm">
          {{ loading ? t("common.loading") : t("streaming.empty.noResults") }}
        </div>
      </div>
    </div>
  </div>
</template>

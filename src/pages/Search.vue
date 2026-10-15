<script setup lang="ts">
defineOptions({ name: "SearchPage" });
import type { Track } from "@shared/types/player";
import { useStreamingStore } from "@/stores/streaming";
const route = useRoute();
const { t } = useI18n();
const streaming = useStreamingStore();
const localTracks = shallowRef<Track[]>([]);
const loading = ref(false);
const error = ref("");
let requestId = 0;
const keyword = computed(() => (typeof route.query.q === "string" ? route.query.q.trim() : ""));
const tracks = computed(() => {
  const q = keyword.value.toLocaleLowerCase();
  if (!q) return [];
  return [
    ...localTracks.value,
    ...streaming.songs.filter((track) =>
      [track.title, track.album?.name, ...track.artists.map((artist) => artist.name)].some(
        (value) => value?.toLocaleLowerCase().includes(q),
      ),
    ),
  ];
});
/** 按关键词查询本地索引并丢弃过期结果 */
const search = async (): Promise<void> => {
  const id = ++requestId;
  localTracks.value = [];
  error.value = "";
  loading.value = true;
  try {
    const result = keyword.value ? await window.api.library.searchTracks(keyword.value) : null;
    if (id !== requestId) return;
    if (result && !result.success) error.value = result.error ?? t("common.error");
    localTracks.value = result?.success ? (result.data ?? []) : [];
  } catch (err) {
    if (id === requestId) error.value = String(err);
  } finally {
    if (id === requestId) loading.value = false;
  }
};
watch(keyword, search, { immediate: true });
</script>

<template>
  <div class="h-full flex flex-col p-6 gap-4">
    <h1 class="text-2xl font-bold">{{ t("nav.search") }}: {{ keyword }}</h1>
    <p v-if="error" class="text-error">{{ error }}</p>
    <SongList :items="tracks" :search-query="keyword" />
  </div>
</template>

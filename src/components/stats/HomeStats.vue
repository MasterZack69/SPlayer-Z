<script setup lang="ts">
defineOptions({ name: "HomeStats" });

import type {
  DailyPlayStats,
  HourlyPlayStats,
  LibraryStats,
  TopAlbum,
  TopArtist,
  TopTrack,
} from "@shared/types/stats";
import StatsOverview from "./StatsOverview.vue";
import StatsHeatmap from "./StatsHeatmap.vue";
import StatsTopList from "./StatsTopList.vue";

const { t } = useI18n();
const error = ref(false);

const libraryStats = ref<LibraryStats | null>(null);
const daily = ref<DailyPlayStats[]>([]);
const hourly = ref<HourlyPlayStats[]>([]);
const topSongs = shallowRef<TopTrack[]>([]);
const topAlbums = shallowRef<TopAlbum[]>([]);
const topArtists = shallowRef<TopArtist[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    error.value = false;
    const [library, history, hourlyHistory, songs, albums, artists] = await Promise.all([
      window.api.stats.getLibraryStats(),
      window.api.stats.getPlayHistoryDaily(90),
      window.api.stats.getPlayHistoryHourly(),
      window.api.stats.getTopTracks(10),
      window.api.stats.getTopAlbums(10),
      window.api.stats.getTopArtists(10),
    ]);
    libraryStats.value = library;
    daily.value = history;
    hourly.value = hourlyHistory;
    topSongs.value = songs;
    topAlbums.value = albums;
    topArtists.value = artists;
  } catch (err) {
    error.value = true;
    console.error("[homeStats] Failed to load listening statistics", err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="flex flex-col gap-5" :aria-label="t('stats.label')" data-home-stats>
    <h2 class="text-xl font-bold text-on-surface">{{ t("stats.label") }}</h2>
    <p v-if="error" role="alert" class="text-sm text-error">{{ t("common.error") }}</p>
    <StatsOverview :stats="libraryStats" />
    <StatsHeatmap :daily="daily" :hourly="hourly" :stats="libraryStats" :loading="loading" />
    <StatsTopList :songs="topSongs" :albums="topAlbums" :artists="topArtists" :loading="loading" />
  </section>
</template>

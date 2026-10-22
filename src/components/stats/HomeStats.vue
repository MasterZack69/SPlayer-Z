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
import { useLibraryStore } from "@/stores/library";
import StatsOverview from "./StatsOverview.vue";
import StatsHeatmap from "./StatsHeatmap.vue";
import StatsYearChart from "./StatsYearChart.vue";
import StatsAudioFormats from "./StatsAudioFormats.vue";
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

const library = useLibraryStore();
let loadGeneration = 0;

/** Refresh every Home statistic after an index update, ignoring stale responses. */
const load = async (): Promise<void> => {
  const generation = ++loadGeneration;
  loading.value = true;
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
    if (generation !== loadGeneration) return;
    libraryStats.value = library;
    daily.value = history;
    hourly.value = hourlyHistory;
    topSongs.value = songs;
    topAlbums.value = albums;
    topArtists.value = artists;
  } catch (err) {
    if (generation !== loadGeneration) return;
    error.value = true;
    console.error("[homeStats] Failed to load listening statistics", err);
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
};

watch(
  () => library.tracks,
  () => {
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <section class="flex flex-col gap-5" :aria-label="t('stats.label')" data-home-stats>
    <h2 class="text-xl font-bold text-on-surface">{{ t("stats.label") }}</h2>
    <p v-if="error" role="alert" class="text-sm text-error">{{ t("common.error") }}</p>
    <StatsOverview :stats="libraryStats" />
    <div
      class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      data-year-formats-row
    >
      <StatsYearChart :tracks="library.tracks" />
      <StatsAudioFormats :stats="libraryStats" :loading="loading" />
    </div>
    <StatsHeatmap :daily="daily" :hourly="hourly" :loading="loading" />
    <StatsTopList :songs="topSongs" :albums="topAlbums" :artists="topArtists" :loading="loading" />
  </section>
</template>

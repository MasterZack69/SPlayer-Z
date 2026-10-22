<script setup lang="ts">
import { useLibraryStore } from "@/stores/library";
import { useStreamingStore } from "@/stores/streaming";
import { usePageSearch } from "@/composables/usePageSearch";
import { getTrackYear, trackYears } from "@shared/utils/year";
import { matchesSearch } from "@/utils/search/match";
import { formatTime } from "@/utils/time";
import type { SSelectOption } from "@/components/ui/SSelect.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const library = useLibraryStore();
const streaming = useStreamingStore();
const filter = usePageSearch();
const error = ref(false);
const sortOrder = ref<"asc" | "desc">("desc");
const sortOptions = computed<SSelectOption[]>(() => [
  { value: "asc", label: t("songList.sort.asc") },
  { value: "desc", label: t("songList.sort.desc") },
]);
const isDetail = computed(() => route.name === "year");
const selected = computed(() =>
  route.params.year === "unknown" ? undefined : Number(route.params.year),
);
const heading = computed(() =>
  route.params.year === "unknown" ? t("year.unknown") : String(route.params.year),
);
const tracks = computed(() => [...library.tracks, ...streaming.songs]);
const years = computed(() => {
  const ordered = trackYears(tracks.value);
  if (sortOrder.value === "desc") ordered.reverse();
  const entries = ordered.map((year) => ({ id: String(year), label: String(year) }));
  if (tracks.value.some((track) => getTrackYear(track) === undefined))
    entries.push({ id: "unknown", label: t("year.unknown") });
  return entries.filter((entry) => matchesSearch(filter.value, entry.label));
});
const songs = computed(() =>
  tracks.value.filter((track) => getTrackYear(track) === selected.value),
);

const totalDuration = computed(() =>
  formatTime(songs.value.reduce((sum, track) => sum + track.duration, 0)),
);

/** Load authoritative local and active-server indexes without scanning from this page. */
const load = async (): Promise<void> => {
  const results = await Promise.allSettled([
    library.initialized ? Promise.resolve() : library.load(),
    streaming.init(),
  ]);
  error.value = results.some((result) => result.status === "rejected");
};
onMounted(load);
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-5 p-5">
    <header v-if="isDetail" class="shrink-0 py-6 text-center">
      <h1 class="text-7xl font-bold tabular-nums">{{ heading }}</h1>
      <div
        data-year-summary
        class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-on-surface-variant/60"
      >
        <span class="flex items-center gap-1">
          <IconLucideListMusic class="size-3.5 shrink-0" />
          {{ t("common.totalSongs", { count: songs.length }) }}
        </span>
        <span class="flex items-center gap-1">
          <IconLucideHourglass class="size-3.5 shrink-0" />
          {{ t("collection.totalDuration", { time: totalDuration }) }}
        </span>
      </div>
    </header>
    <header v-else class="flex shrink-0 flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-bold">{{ t("year.label") }}</h1>
      <div
        role="group"
        :aria-label="t('songList.sort.mode')"
        class="flex items-center gap-2 text-sm text-on-surface-variant/70"
      >
        <IconLucideArrowUpDown class="size-3.5 shrink-0" />
        <span>{{ t("songList.sort.mode") }}</span>
        <div class="w-40">
          <SSelect v-model="sortOrder" :options="sortOptions" />
        </div>
      </div>
    </header>
    <p v-if="error" role="alert" class="text-error">{{ t("common.error") }}</p>
    <div
      v-if="!isDetail"
      class="scrollbar-hidden flex flex-1 min-h-0 flex-col items-start gap-4 overflow-y-auto"
    >
      <button
        v-for="year in years"
        :key="year.id"
        class="appearance-none border-none bg-transparent p-0 text-left text-xl text-on-surface tabular-nums cursor-pointer hover:underline focus-visible:underline"
        @click="router.push({ name: 'year', params: { year: year.id } })"
      >
        {{ year.label }}
      </button>
      <p v-if="!years.length" class="text-on-surface-variant/60">{{ t("search.noResults") }}</p>
    </div>
    <div v-else class="min-h-0 flex-1">
      <SongList
        :items="songs"
        :search-query="filter"
        enable-sort
        sort-key="years"
        :playback-context="{
          originType: 'page',
          originId: `year:${route.params.year}`,
          originName: heading,
        }"
      />
    </div>
  </section>
</template>
